import 'server-only'
import { db } from '../db'
import { insertCanonicalTransaction } from '../transactions'
import { normalizeMerchant } from '../money'
import type { AccountProvider, RawTransaction } from '../types'

// ── Stripe-receipt parser ──────────────────────────────────────────────────
// ONE parser covers the emailed/JSON receipts that OpenAI, Anthropic, and
// Cursor all bill through Stripe (plus generic Stripe invoices). It maps a
// Stripe Invoice's `lines[].data[]` into our canonical RawTransaction[]
// (expense = POSITIVE). No live Stripe SDK call is required to parse — the
// caller supplies the already-parsed JSON (from a webhook, an emailed receipt
// JSON, or a manual paste). `provider` can be forced or detected from the
// statement descriptor.
//
// Sample-shaped fixture (trimmed Stripe Invoice JSON):
//   {
//     "id": "in_1OabcXYZ",
//     "object": "invoice",
//     "currency": "usd",
//     "amount_due": 4312,
//     "statement_descriptor": "OPENAI",
//     "account_name": "OpenAI",
//     "created": 1714521600,
//     "lines": {
//       "object": "list",
//       "data": [
//         { "description": "GPT-4o input tokens", "amount": 2890,
//           "period": { "start": 1711929600, "end": 1714521600 } },
//         { "description": "GPT-4o output tokens", "amount": 1422,
//           "period": { "start": 1711929600, "end": 1714521600 } }
//       ]
//     }
//   }
// Stripe amounts are smallest-currency-unit integers (cents for USD) and are
// already positive for a charge → straight to expense-positive cents.

export type ReceiptProvider = 'openai' | 'anthropic' | 'cursor' | 'stripe'

interface StripePeriod {
  start?: number | null
  end?: number | null
}

interface StripeInvoiceLine {
  description?: string | null
  amount?: number | null
  currency?: string | null
  period?: StripePeriod | null
  price?: { unit_amount?: number | null } | null
  quantity?: number | null
}

export interface StripeInvoiceJson {
  id?: string | null
  object?: string
  currency?: string | null
  amount_due?: number | null
  amount_paid?: number | null
  total?: number | null
  created?: number | null
  statement_descriptor?: string | null
  account_name?: string | null
  customer_name?: string | null
  number?: string | null
  lines?: { data?: StripeInvoiceLine[] | null } | StripeInvoiceLine[] | null
}

/** Map a known provider statement-descriptor / name to its provider key. */
export function detectProvider(descriptor: string | null | undefined): ReceiptProvider {
  const d = (descriptor ?? '').toLowerCase()
  if (d.includes('openai') || d.includes('chatgpt') || d.includes('gpt')) return 'openai'
  if (d.includes('anthropic') || d.includes('claude')) return 'anthropic'
  if (d.includes('cursor')) return 'cursor'
  return 'stripe'
}

function epochToDate(epoch: number | null | undefined, fallback: string): string {
  if (!epoch || !Number.isFinite(epoch)) return fallback
  return new Date(epoch * 1000).toISOString().slice(0, 10)
}

function linesOf(invoice: StripeInvoiceJson): StripeInvoiceLine[] {
  const l = invoice.lines
  if (!l) return []
  if (Array.isArray(l)) return l
  return l.data ?? []
}

/**
 * Parse a Stripe invoice JSON into canonical RawTransaction[]. One row per
 * line item (description + smallest-unit amount + period). Falls back to a
 * single line from the invoice total when no line items are present.
 */
export function parseStripeReceipt(input: {
  json?: StripeInvoiceJson | null
  provider?: string
  accountRef?: string
}): RawTransaction[] {
  const invoice = input.json
  if (!invoice) return []

  const provider = (input.provider as ReceiptProvider | undefined)
    ?? detectProvider(invoice.statement_descriptor ?? invoice.account_name ?? invoice.customer_name)
  const merchant = providerLabel(provider, invoice)
  const currency = (invoice.currency ?? 'usd').toLowerCase()
  const createdDate = epochToDate(invoice.created, new Date().toISOString().slice(0, 10))
  const invoiceId = invoice.id ?? invoice.number ?? `stripe-${createdDate}`
  const accountRef = input.accountRef ?? ''

  const lines = linesOf(invoice)
  const rows: RawTransaction[] = []

  if (lines.length > 0) {
    lines.forEach((line, i) => {
      const amount =
        line.amount ??
        (line.price?.unit_amount != null ? line.price.unit_amount * (line.quantity ?? 1) : 0)
      const amountCents = Math.round(Number(amount) || 0)
      if (amountCents === 0) return
      const occurred = epochToDate(line.period?.end, createdDate)
      rows.push({
        external_id: `${invoiceId}:${i}`,
        source: 'stripe',
        account_ref: accountRef,
        amount_cents: amountCents, // Stripe charge is positive = expense
        raw_amount_cents: amountCents,
        raw_sign_source: 'stripe',
        currency: (line.currency ?? currency).toLowerCase(),
        occurred_on: occurred,
        posted_on: occurred,
        merchant_hint: merchant,
        description: line.description ?? merchant,
        category_hint: provider === 'stripe' ? null : 'AI & compute',
      })
    })
  }

  if (rows.length === 0) {
    const total = invoice.amount_paid ?? invoice.amount_due ?? invoice.total ?? 0
    const amountCents = Math.round(Number(total) || 0)
    if (amountCents !== 0) {
      rows.push({
        external_id: invoiceId,
        source: 'stripe',
        account_ref: accountRef,
        amount_cents: amountCents,
        raw_amount_cents: amountCents,
        raw_sign_source: 'stripe',
        currency,
        occurred_on: createdDate,
        posted_on: createdDate,
        merchant_hint: merchant,
        description: `${merchant} invoice`,
        category_hint: provider === 'stripe' ? null : 'AI & compute',
      })
    }
  }

  return rows
}

function providerLabel(provider: ReceiptProvider, invoice: StripeInvoiceJson): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'cursor':
      return 'Cursor'
    default:
      return invoice.account_name ?? invoice.statement_descriptor ?? 'Stripe'
  }
}

/** The set of detectable providers that map onto our account_provider enum. */
function providerToAccountProvider(p: ReceiptProvider): AccountProvider {
  if (p === 'openai' || p === 'anthropic' || p === 'cursor') return p
  return 'stripe'
}

export interface IngestInvoiceResult {
  ok: boolean
  invoiceId: string | null
  transactionIds: string[]
  error?: string
}

/**
 * Persist a parsed Stripe invoice as a provider_invoices row AND its canonical
 * transactions (expense positive). `accountRef` is the financial_accounts.id
 * the charges should land on (a provider-invoice account or the paying card).
 * Idempotent on the provider_invoices.external_invoice_id where present.
 */
export async function ingestStripeInvoice(
  ownerId: string,
  invoice: StripeInvoiceJson,
  accountRef: string,
  opts: { projectId?: string; provider?: ReceiptProvider } = {},
): Promise<IngestInvoiceResult> {
  const result: IngestInvoiceResult = { ok: false, invoiceId: null, transactionIds: [] }
  try {
    const provider = opts.provider
      ?? detectProvider(invoice.statement_descriptor ?? invoice.account_name ?? invoice.customer_name)
    const rows = parseStripeReceipt({ json: invoice, provider, accountRef })
    const lines = linesOf(invoice)
    const createdDate = epochToDate(invoice.created, new Date().toISOString().slice(0, 10))
    const totalCents = rows.reduce((sum, r) => sum + r.amount_cents, 0)
    const periodStarts = lines.map((l) => l.period?.start).filter(Boolean) as number[]
    const periodEnds = lines.map((l) => l.period?.end).filter(Boolean) as number[]
    const externalInvoiceId = invoice.id ?? invoice.number ?? null

    // provider_invoices upsert (manual dedup on external_invoice_id).
    let invoiceRowId: string | null = null
    if (externalInvoiceId) {
      const existing = await db()
        .from('provider_invoices')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('external_invoice_id', externalInvoiceId)
        .maybeSingle()
      invoiceRowId = (existing.data as { id: string } | null)?.id ?? null
    }
    const invoicePayload = {
      owner_id: ownerId,
      financial_account_id: accountRef || null,
      provider: providerToAccountProvider(provider),
      external_invoice_id: externalInvoiceId,
      period_start: periodStarts.length ? epochToDate(Math.min(...periodStarts), createdDate) : createdDate,
      period_end: periodEnds.length ? epochToDate(Math.max(...periodEnds), createdDate) : createdDate,
      total_cents: totalCents,
      currency: (invoice.currency ?? 'usd').toLowerCase(),
      line_items: rows.map((r) => ({ description: r.description, amount_cents: r.amount_cents })),
    }
    if (invoiceRowId) {
      const upd = await db().from('provider_invoices').update(invoicePayload).eq('id', invoiceRowId).select('id').single()
      invoiceRowId = (upd.data as { id: string } | null)?.id ?? invoiceRowId
    } else {
      const ins = await db().from('provider_invoices').insert(invoicePayload).select('id').single()
      invoiceRowId = (ins.data as { id: string } | null)?.id ?? null
    }
    result.invoiceId = invoiceRowId

    // Canonical transactions (only when we have a real account + a project to
    // allocate against — the caller passes a project, else they remain on the
    // invoice record only to avoid double-counting against the card charge).
    if (accountRef && opts.projectId) {
      for (const raw of rows) {
        const txnId = await insertCanonicalTransaction(ownerId, raw, { projectId: opts.projectId })
        result.transactionIds.push(txnId)
      }
    }

    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'ingest_failed'
    return result
  }
}

/** Exposed for reconcile / tests: the stable merchant token for a provider. */
export function providerMerchantToken(provider: ReceiptProvider): string {
  return normalizeMerchant(providerLabel(provider, {}))
}
