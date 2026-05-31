// src/lib/mcp/tools/import-invoice.ts
//
// WRITE tool — the ingestion MOAT. Parse a provider's usage invoice (the
// emailed/JSON receipts that OpenAI, Anthropic, Cursor, … all bill through
// Stripe, plus generic Stripe invoices) into first-class, per-line-item
// transactions, persist the provider_invoices record, optionally allocate the
// line items to a named project, THEN reconcile so the parsed invoice never
// double-counts against the paying card charge.
//
// No external credentials are needed: the parser takes already-parsed JSON
// (from a webhook, an emailed-receipt JSON, or a manual paste). The agent in
// Claude Code / Cursor pastes the invoice; we do the rest.
import 'server-only'
import { z } from 'zod'
import { db } from '@/lib/money/db'
import { formatCents } from '@/lib/money/money'
import { resolveProject } from './_shared'
import {
  detectProvider,
  ingestStripeInvoice,
  parseStripeReceipt,
  type ReceiptProvider,
  type StripeInvoiceJson,
} from '@/lib/money/ingest/stripe-receipt'
import { reconcileInvoiceWithCharge } from '@/lib/money/ingest/reconcile'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import type { AccountProvider } from '@/lib/money/types'
import { text, type MoneyToolCtx, type ToolResult } from './_shared'

// The providers the agent may force. These are the set the parser AND the
// reconciler both model first-class end-to-end (ingestStripeInvoice maps the
// ReceiptProvider → account_provider, and reconcile matches each by merchant
// token). Vercel & Supabase also bill through Stripe but aren't modelled by the
// current shared parser, so an invoice from them is best left to auto-detection
// / generic 'stripe' handling rather than mis-forced — omit `provider` for those.
const PROVIDER_VALUES = ['openai', 'anthropic', 'cursor', 'stripe'] as const

export const importInvoiceInput = {
  invoice: z
    .record(z.string(), z.unknown())
    .describe(
      'A Stripe-invoice-shaped JSON object (the emailed/webhook receipt). Expects { currency, created, statement_descriptor|account_name, amount_due|amount_paid|total, lines: { data: [{ description, amount, period: { start, end } }] } }. Stripe amounts are smallest-currency-unit integers (cents). One transaction is created per line item.',
    ),
  provider: z
    .enum(PROVIDER_VALUES)
    .optional()
    .describe(
      'Force the provider (openai | anthropic | cursor | stripe). Omit to auto-detect from the invoice statement_descriptor / account_name — recommended for Vercel/Supabase and any other Stripe-billed vendor.',
    ),
  project: z
    .string()
    .optional()
    .describe(
      'Project slug or id to allocate the line items to. Omit to leave the invoice parsed-but-untagged (its charges stay in Personal / Unallocated until tagged).',
    ),
}

/**
 * Find (or create) the owner's provider-invoice financial account for a given
 * provider. This account is `kind: 'provider_invoice'` on purpose: reconcile
 * EXCLUDES provider_invoice-kind accounts from the candidate paying-charge set,
 * so the line items we land here are never mis-matched as the card charge that
 * pays the invoice. One account per (owner, provider).
 */
async function ensureProviderInvoiceAccount(
  ownerId: string,
  provider: AccountProvider,
): Promise<string> {
  const { data: existing, error } = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('provider', provider)
    .eq('kind', 'provider_invoice')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (existing) return (existing as { id: string }).id

  const label = providerDisplayName(provider)
  const { data: created, error: insErr } = await db()
    .from('financial_accounts')
    .insert({
      owner_id: ownerId,
      provider,
      kind: 'provider_invoice',
      display_name: `${label} invoices`,
      currency: 'usd',
      status: 'active',
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return (created as { id: string }).id
}

function providerDisplayName(provider: AccountProvider): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'cursor':
      return 'Cursor'
    case 'vercel':
      return 'Vercel'
    case 'supabase':
      return 'Supabase'
    default:
      return 'Stripe'
  }
}

/** Map a detected ReceiptProvider to our account_provider enum. */
function toAccountProvider(p: ReceiptProvider): AccountProvider {
  return p
}

export async function runImportInvoice(
  ctx: MoneyToolCtx,
  args: { invoice: Record<string, unknown>; provider?: ReceiptProvider; project?: string },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.write)

  const invoice = args.invoice as StripeInvoiceJson

  // Resolve the provider (forced or detected) so we can scope the
  // provider-invoice account and produce a clear summary up-front.
  const provider: ReceiptProvider =
    args.provider ??
    detectProvider(invoice.statement_descriptor ?? invoice.account_name ?? invoice.customer_name)

  // Pre-parse so we can fail clearly on an empty/unparseable invoice BEFORE we
  // create any rows, and so the summary can report the line count even when the
  // invoice has no detectable charges.
  const preview = parseStripeReceipt({ json: invoice, provider })
  if (preview.length === 0) {
    return text(
      `Could not parse any line items or a total from the supplied ${providerDisplayName(
        toAccountProvider(provider),
      )} invoice. Expected a Stripe-invoice-shaped JSON with non-zero lines[].data[].amount or an amount_due/amount_paid/total.`,
      { ok: false, provider, line_items: 0 },
    )
  }

  // Find-or-create the provider-invoice account these charges land on.
  const accountId = await ensureProviderInvoiceAccount(ctx.ownerId, toAccountProvider(provider))

  // Resolve the optional target project. When omitted, the line items are NOT
  // written as canonical transactions (ingestStripeInvoice only materializes
  // them when given a projectId) — the invoice record alone stands, untagged,
  // until a human/agent tags it. When given, the line items allocate to it.
  const project = args.project ? await resolveProject(ctx.ownerId, args.project) : null

  const ingest = await ingestStripeInvoice(ctx.ownerId, invoice, accountId, {
    provider,
    projectId: project?.id,
  })

  if (!ingest.ok || !ingest.invoiceId) {
    return text(`Failed to import the ${providerDisplayName(toAccountProvider(provider))} invoice: ${ingest.error ?? 'unknown error'}.`, {
      ok: false,
      provider,
      error: ingest.error ?? 'ingest_failed',
    })
  }

  // Reconcile against the paying card charge so the invoice doesn't
  // double-count in the per-project P&L. Idempotent + non-destructive: a
  // no-match is a success with reconciled=false.
  const reconcile = await reconcileInvoiceWithCharge(ctx.ownerId, ingest.invoiceId)

  // Build the summary from the persisted invoice row (authoritative period +
  // total) so the figures reported match what landed in the DB.
  const { data: invRow } = await db()
    .from('provider_invoices')
    .select('period_start, period_end, total_cents, currency')
    .eq('owner_id', ctx.ownerId)
    .eq('id', ingest.invoiceId)
    .maybeSingle()
  const row = (invRow as
    | { period_start: string | null; period_end: string | null; total_cents: number; currency: string }
    | null) ?? null

  const totalCents = row?.total_cents ?? preview.reduce((s, r) => s + r.amount_cents, 0)
  const currency = row?.currency ?? (invoice.currency ?? 'usd').toLowerCase()
  const period =
    row?.period_start && row?.period_end
      ? row.period_start === row.period_end
        ? row.period_start
        : `${row.period_start} → ${row.period_end}`
      : 'unknown period'
  const providerLabel = providerDisplayName(toAccountProvider(provider))
  const lineCount = preview.length
  const tagged = project ? `→ ${project.name}` : '→ Personal / Unallocated (untagged)'

  const reconciledNote = reconcile.reconciled
    ? `reconciled against the paying card charge (txn ${reconcile.txnId}) — no double-count`
    : `no paying card charge matched yet (${reconcile.reason ?? 'no_match'}) — will reconcile once the card charge lands`

  const summary =
    `Imported ${providerLabel} invoice for ${period}: ${formatCents(totalCents, currency)} across ` +
    `${lineCount} line item${lineCount === 1 ? '' : 's'} ${tagged}. ${reconciledNote}.`

  return text(summary, {
    ok: true,
    provider,
    invoice_id: ingest.invoiceId,
    financial_account_id: accountId,
    period_start: row?.period_start ?? null,
    period_end: row?.period_end ?? null,
    total_cents: totalCents,
    currency,
    line_item_count: lineCount,
    transaction_ids: ingest.transactionIds,
    project_id: project?.id ?? null,
    project_slug: project?.slug ?? null,
    tagged: Boolean(project),
    reconciled: reconcile.reconciled,
    reconciled_txn_id: reconcile.txnId,
    reconcile_reason: reconcile.reason ?? null,
  })
}
