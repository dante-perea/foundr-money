import 'server-only'
import { db } from '../db'
import { normalizeMerchant } from '../money'
import type { AccountProvider } from '../types'

// ── Reconcile provider invoice ⇄ paying card charge ────────────────────────
// A provider's usage invoice (OpenAI, Anthropic, Vercel, …) and the card
// charge that PAYS for it are two records for ONE economic event. If both are
// ingested and both allocate to a project, per-project burn DOUBLES. Reconcile
// links the invoice to its paying transaction (amount + merchant + date window
// ±3 days) by stamping provider_invoices.reconciled_txn_id — the P&L rollup can
// then dedupe (count the invoice OR the charge, not both).

const WINDOW_DAYS = 3

interface InvoiceRow {
  id: string
  owner_id: string
  provider: AccountProvider
  total_cents: number
  period_start: string | null
  period_end: string | null
  reconciled_txn_id: string | null
}

interface TxnRow {
  id: string
  amount_cents: number
  merchant_name: string | null
  posted_at: string
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a)
  const db_ = Date.parse(b)
  if (Number.isNaN(da) || Number.isNaN(db_)) return Number.POSITIVE_INFINITY
  return Math.abs(da - db_) / 86_400_000
}

/** The merchant token a provider's card charge is expected to carry. */
function providerMerchantTokens(provider: AccountProvider): string[] {
  switch (provider) {
    case 'openai':
      return [normalizeMerchant('OpenAI')]
    case 'anthropic':
      return [normalizeMerchant('Anthropic'), normalizeMerchant('Claude')]
    case 'vercel':
      return [normalizeMerchant('Vercel')]
    case 'cursor':
      return [normalizeMerchant('Cursor')]
    case 'supabase':
      return [normalizeMerchant('Supabase')]
    case 'stripe':
      return [normalizeMerchant('Stripe')]
    default:
      return []
  }
}

export interface ReconcileResult {
  ok: boolean
  reconciled: boolean
  invoiceId: string
  txnId: string | null
  reason?: string
}

/**
 * Find a transactions row matching the invoice (amount within ±$0.50, merchant
 * token contains a provider token, posted_at within ±3 days of the invoice
 * period_end) and stamp provider_invoices.reconciled_txn_id. Idempotent: a
 * already-reconciled invoice is a no-op success.
 */
export async function reconcileInvoiceWithCharge(
  ownerId: string,
  invoiceId: string,
): Promise<ReconcileResult> {
  const result: ReconcileResult = { ok: false, reconciled: false, invoiceId, txnId: null }
  try {
    const { data: invData, error: invErr } = await db()
      .from('provider_invoices')
      .select('id, owner_id, provider, total_cents, period_start, period_end, reconciled_txn_id')
      .eq('owner_id', ownerId)
      .eq('id', invoiceId)
      .maybeSingle()
    if (invErr || !invData) {
      result.reason = 'invoice_not_found'
      return result
    }
    const invoice = invData as InvoiceRow
    if (invoice.reconciled_txn_id) {
      result.ok = true
      result.reconciled = true
      result.txnId = invoice.reconciled_txn_id
      result.reason = 'already_reconciled'
      return result
    }

    const anchor =
      invoice.period_end ?? invoice.period_start ?? new Date().toISOString().slice(0, 10)
    const lo = new Date(Date.parse(anchor) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const hi = new Date(Date.parse(anchor) + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const tokens = providerMerchantTokens(invoice.provider)

    // Candidate charges: same owner, expense (positive), in the date window.
    // Exclude provider-invoice-sourced rows so we only match real card charges.
    const { data: cands } = await db()
      .from('transactions')
      .select('id, amount_cents, merchant_name, posted_at, financial_accounts!inner(kind)')
      .eq('owner_id', ownerId)
      .gte('posted_at', lo)
      .lte('posted_at', hi)
      .neq('financial_accounts.kind', 'provider_invoice')

    const candidates = ((cands ?? []) as unknown as TxnRow[]).filter((t) => {
      // amount match within 50 cents tolerance, expense side only
      if (Math.abs(t.amount_cents - invoice.total_cents) > 50) return false
      if (tokens.length === 0) return true
      const m = normalizeMerchant(t.merchant_name)
      return tokens.some((tok) => tok && m.includes(tok))
    })

    if (candidates.length === 0) {
      result.ok = true
      result.reason = 'no_match'
      return result
    }

    // Prefer the closest-dated candidate.
    candidates.sort((a, b) => daysBetween(a.posted_at, anchor) - daysBetween(b.posted_at, anchor))
    const match = candidates[0]

    const { error: updErr } = await db()
      .from('provider_invoices')
      .update({ reconciled_txn_id: match.id })
      .eq('id', invoiceId)
      .eq('owner_id', ownerId)
    if (updErr) {
      result.reason = updErr.message
      return result
    }

    result.ok = true
    result.reconciled = true
    result.txnId = match.id
    return result
  } catch (err) {
    result.reason = err instanceof Error ? err.message : 'reconcile_failed'
    return result
  }
}

/** Reconcile every still-unreconciled provider invoice for an owner. */
export async function reconcileAllInvoices(ownerId: string): Promise<ReconcileResult[]> {
  const { data } = await db()
    .from('provider_invoices')
    .select('id')
    .eq('owner_id', ownerId)
    .is('reconciled_txn_id', null)
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
  const out: ReconcileResult[] = []
  for (const id of ids) out.push(await reconcileInvoiceWithCharge(ownerId, id))
  return out
}
