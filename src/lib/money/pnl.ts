import 'server-only'
import { db } from './db'
import type { ProjectPnl } from './types'

export type Period = 'last30' | 'mtd' | 'ytd' | 'all'

export const PERIOD_LABELS: Record<Period, string> = {
  last30: 'Last 30 days',
  mtd: 'Month to date',
  ytd: 'Year to date',
  all: 'All time',
}

function periodStart(period: Period): string | null {
  const now = new Date()
  if (period === 'last30') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'mtd') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  if (period === 'ytd') return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  return null
}

function monthlyCents(amount: number, interval: string, count: number): number {
  const c = count || 1
  if (interval === 'year') return Math.round(amount / (12 * c))
  if (interval === 'week') return Math.round((amount * 52) / (12 * c))
  if (interval === 'day') return Math.round((amount * 365) / (12 * c))
  return Math.round(amount / c) // month
}

/** Per-project P&L for a period, one row per project (including Personal). */
export async function portfolioPnl(ownerId: string, period: Period = 'last30'): Promise<ProjectPnl[]> {
  const start = periodStart(period)

  // Base: every project (so zero-activity projects still show).
  const { data: projects, error: pErr } = await db()
    .from('projects')
    .select('id, name, slug, color, is_personal')
    .eq('owner_id', ownerId)
    .order('is_personal', { ascending: true })
    .order('created_at', { ascending: true })
  if (pErr) throw pErr

  const rollup = new Map<string, ProjectPnl>()
  for (const p of projects ?? []) {
    rollup.set(p.id, {
      project_id: p.id,
      project_name: p.name,
      project_slug: p.slug,
      project_color: p.color,
      is_personal: p.is_personal,
      income_cents: 0,
      expense_cents: 0,
      net_cents: 0,
      mrr_cents: 0,
      txn_count: 0,
    })
  }

  // ── Double-count guard: reconciled provider invoices ──────────────────────
  // A provider's usage (Vercel/OpenAI/…) is ingested as GRANULAR per-project
  // transactions (on a kind='provider_invoice' account) so we get per-project
  // burn. The bank/card statement ALSO carries the lump-sum charge that PAID
  // that bill (on a kind='card'/'bank' account). Both are real transactions,
  // both allocate to a project — summing both DOUBLES the spend for one
  // economic event. reconcile.ts matches the invoice to its paying card charge
  // and stamps provider_invoices.reconciled_txn_id with that PAYING txn's id
  // (it explicitly excludes provider_invoice-account rows as match candidates).
  //
  // Dedupe rule: keep the granular usage line items (they carry the per-project
  // signal) and EXCLUDE the reconciled paying charge. So we collect every
  // reconciled_txn_id and skip its allocations below. The lump-sum charge is
  // still visible as a transaction in the ledger — it is only omitted from the
  // P&L sum to avoid counting the same dollars twice.
  //
  // NOTE: provider_invoices itself is NEVER summed here — it is a record, not a
  // ledger. Its line items are already represented as the per-project usage
  // transactions. The only thing it contributes to the rollup is this exclusion
  // set of paying charges.
  const { data: reconciled, error: rErr } = await db()
    .from('provider_invoices')
    .select('reconciled_txn_id')
    .eq('owner_id', ownerId)
    .not('reconciled_txn_id', 'is', null)
  if (rErr) throw rErr
  const reconciledTxnIds = new Set(
    ((reconciled ?? []) as { reconciled_txn_id: string | null }[])
      .map((r) => r.reconciled_txn_id)
      .filter((id): id is string => Boolean(id)),
  )

  // Allocations joined to transactions for the date filter.
  let q = db()
    .from('transaction_allocations')
    .select('amount_cents, project_id, transaction_id, transactions!inner(posted_at)')
    .eq('owner_id', ownerId)
  if (start) q = q.gte('transactions.posted_at', start)
  const { data: allocs, error: aErr } = await q
  if (aErr) throw aErr

  for (const a of (allocs ?? []) as {
    amount_cents: number
    project_id: string
    transaction_id: string
  }[]) {
    // Skip the paying card/bank charge that a provider invoice reconciles to —
    // its dollars are already counted via the granular usage line items.
    if (reconciledTxnIds.has(a.transaction_id)) continue
    const r = rollup.get(a.project_id)
    if (!r) continue
    if (a.amount_cents >= 0) r.expense_cents += a.amount_cents
    else r.income_cents += -a.amount_cents
    r.txn_count += 1
  }

  // MRR from Stripe subscriptions (normalized monthly), per project.
  const { data: subs } = await db()
    .from('stripe_subscriptions')
    .select('amount_cents, discount_monthly_cents, interval, interval_count, status, project_id')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
  for (const s of (subs ?? []) as {
    amount_cents: number
    discount_monthly_cents: number
    interval: string
    interval_count: number
    project_id: string | null
  }[]) {
    if (!s.project_id) continue
    const r = rollup.get(s.project_id)
    if (!r) continue
    r.mrr_cents += monthlyCents(s.amount_cents, s.interval, s.interval_count) - (s.discount_monthly_cents ?? 0)
  }

  for (const r of rollup.values()) r.net_cents = r.income_cents - r.expense_cents
  return [...rollup.values()]
}

export interface PortfolioTotals {
  expense_cents: number
  income_cents: number
  net_cents: number
  mrr_cents: number
  project_count: number
  untagged_count: number
}

export async function portfolioTotals(rows: ProjectPnl[], untaggedCount: number): Promise<PortfolioTotals> {
  const t = rows.reduce(
    (acc, r) => {
      acc.expense_cents += r.expense_cents
      acc.income_cents += r.income_cents
      acc.mrr_cents += r.mrr_cents
      return acc
    },
    { expense_cents: 0, income_cents: 0, mrr_cents: 0 },
  )
  return {
    ...t,
    net_cents: t.income_cents - t.expense_cents,
    project_count: rows.filter((r) => !r.is_personal).length,
    untagged_count: untaggedCount,
  }
}
