import 'server-only'
import { db } from './db'
import type { RawTransaction, TransactionWithAllocations } from './types'

const SELECT = `
  *,
  account:financial_accounts(display_name, provider),
  allocations:transaction_allocations(*, project:projects(name, slug, color, is_personal))
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): TransactionWithAllocations {
  return {
    ...row,
    account_name: row.account?.display_name ?? 'Account',
    account_provider: row.account?.provider ?? 'manual',
    allocations: (row.allocations ?? []).map((a: any) => ({
      ...a,
      project_name: a.project?.name ?? 'Unknown',
      project_slug: a.project?.slug ?? 'personal',
      project_color: a.project?.color ?? '#94a3b8',
      project_is_personal: a.project?.is_personal ?? false,
    })),
  }
}

export async function listTransactions(
  ownerId: string,
  opts: { limit?: number; accountId?: string } = {},
): Promise<TransactionWithAllocations[]> {
  let q = db()
    .from('transactions')
    .select(SELECT)
    .eq('owner_id', ownerId)
    .order('posted_at', { ascending: false })
    .limit(opts.limit ?? 200)
  if (opts.accountId) q = q.eq('financial_account_id', opts.accountId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** Transactions whose only allocation is the Personal/Unallocated project. */
export async function listUntagged(
  ownerId: string,
  opts: { limit?: number } = {},
): Promise<TransactionWithAllocations[]> {
  const all = await listTransactions(ownerId, { limit: 500 })
  const untagged = all.filter(
    (t) =>
      t.allocations.length > 0 &&
      t.allocations.every((a) => (a as { project_is_personal?: boolean }).project_is_personal),
  )
  return untagged.slice(0, opts.limit ?? 50)
}

export async function getTransaction(
  ownerId: string,
  txnId: string,
): Promise<TransactionWithAllocations | null> {
  const { data, error } = await db()
    .from('transactions')
    .select(SELECT)
    .eq('owner_id', ownerId)
    .eq('id', txnId)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

/** Upsert a canonical transaction + a single full-amount allocation (atomic RPC). */
export async function insertCanonicalTransaction(
  ownerId: string,
  raw: RawTransaction,
  alloc: { projectId: string; categoryId?: string | null },
): Promise<string> {
  const direction = raw.amount_cents >= 0 ? 'expense' : 'income'
  const { data, error } = await db().rpc('fm_insert_transaction', {
    p_owner: ownerId,
    p_account: raw.account_ref,
    p_external_id: raw.external_id,
    p_posted: raw.posted_on,
    p_amount: raw.amount_cents,
    p_raw_amount: raw.raw_amount_cents,
    p_raw_sign: raw.raw_sign_source,
    p_direction: direction,
    p_currency: raw.currency,
    p_merchant: raw.merchant_hint,
    p_description: raw.description,
    p_pfc_primary: raw.pfc_primary ?? null,
    p_pfc_detailed: raw.pfc_detailed ?? null,
    p_pending: raw.pending ?? false,
    p_project: alloc.projectId,
    p_category: alloc.categoryId ?? null,
  })
  if (error) throw error
  return data as string
}
