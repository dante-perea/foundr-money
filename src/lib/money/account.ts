import 'server-only'
import { db } from './db'

// Account-settings data layer: disconnect a single financial account, or wipe
// every owner-scoped row (GDPR/CCPA erasure). Both are STRICTLY owner-scoped —
// every statement carries `.eq('owner_id', owner)` so one founder can never
// touch another's data. Service role bypasses RLS, so owner-scoping here is the
// only boundary; it is not optional.

/**
 * Disconnect a single financial account and remove the spend it fed.
 *
 * The DB has `transactions.financial_account_id … on delete cascade` and
 * `transaction_allocations.transaction_id … on delete cascade`. The allocation
 * sum-check is a DEFERRED constraint trigger that fires at COMMIT, and each
 * Supabase .delete() is its own transaction — so we delete `transactions`
 * FIRST. That cascades their allocations within the same transaction, and the
 * trigger's "parent txn gone → return null" guard makes the deferred check a
 * no-op (deleting allocations on their own would instead leave the parent txn
 * present with a 0-sum mismatch and RAISE). provider_invoices /
 * recurring_streams / stripe_subscriptions referencing this account resolve via
 * their own FK rules (set null / cascade).
 *
 * Owner-scoped throughout: the account id is matched together with owner_id, so
 * passing another owner's account id is a no-op.
 */
export async function disconnectAccount(owner: string, accountId: string): Promise<void> {
  const client = db()

  // Confirm the account belongs to this owner before touching anything.
  const { data: acct, error: lookupErr } = await client
    .from('financial_accounts')
    .select('id, plaid_item_id')
    .eq('owner_id', owner)
    .eq('id', accountId)
    .maybeSingle()
  if (lookupErr) throw lookupErr
  if (!acct) return // not this owner's account (or already gone) — no-op

  const { plaid_item_id } = acct as { id: string; plaid_item_id: string | null }

  // Delete this account's transactions (owner-scoped); the cascade clears their
  // allocations in the same transaction so the deferred sum-check no-ops.
  const { error: delTxnErr } = await client
    .from('transactions')
    .delete()
    .eq('owner_id', owner)
    .eq('financial_account_id', accountId)
  if (delTxnErr) throw delTxnErr

  // Drop the underlying Plaid item (access-token lifecycle) if this account was
  // the only one fed by it. plaid_items is keyed by item_id, owner-scoped.
  if (plaid_item_id) {
    const { count } = await client
      .from('financial_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner)
      .eq('plaid_item_id', plaid_item_id)
      .neq('id', accountId)
    if ((count ?? 0) === 0) {
      const { error: plaidErr } = await client
        .from('plaid_items')
        .delete()
        .eq('owner_id', owner)
        .eq('item_id', plaid_item_id)
      if (plaidErr) throw plaidErr
    }
  }

  const { error: acctErr } = await client
    .from('financial_accounts')
    .delete()
    .eq('owner_id', owner)
    .eq('id', accountId)
  if (acctErr) throw acctErr
}

// Owner-scoped tables, ordered so every delete satisfies the schema's FKs and
// the DEFERRED allocation sum-check.
//
// Critical ordering note: each Supabase .delete() is its OWN transaction, so a
// bulk `delete from transaction_allocations` would commit with the parent
// transactions still present — the deferred fm_check_alloc_sum trigger would
// then see alloc-sum 0 ≠ txn-total and RAISE. So we delete `transactions`
// FIRST: that cascades its allocations within the same transaction, and the
// trigger's "parent txn gone → return null" guard makes the deferred check a
// no-op. After transactions are gone, `projects` is free of the
// `transaction_allocations.project_id … on delete restrict` reference.
//
// `categories` is owner-scoped here — system categories carry `owner_id = null`
// and are deliberately left untouched.
const OWNER_SCOPED_DELETE_ORDER = [
  'mcp_call_log',
  'tagging_feedback',
  'transactions', // cascades transaction_allocations; trigger no-ops (parent gone)
  'external_project_map',
  'merchant_rules',
  'recurring_streams',
  'stripe_subscriptions',
  'provider_invoices',
  'money_agent_keys',
  'financial_accounts',
  'plaid_items',
  'projects',
  'categories',
  'onboarding',
] as const

/**
 * Permanently erase EVERY owner-scoped row for this owner across all tables —
 * the GDPR/CCPA "delete all my data" path. Strictly owner-scoped: every delete
 * is `.eq('owner_id', owner)`, so no other owner's data is ever touched. System
 * categories (`owner_id = null`) are preserved. Ordered child→parent so FKs and
 * the deferred allocation sum-check are satisfied at every step.
 *
 * After this returns the workspace is empty; the caller redirects the founder
 * back through onboarding to start fresh.
 */
export async function deleteAllOwnerData(owner: string): Promise<void> {
  const client = db()
  for (const table of OWNER_SCOPED_DELETE_ORDER) {
    const { error } = await client.from(table).delete().eq('owner_id', owner)
    if (error) throw new Error(`deleteAllOwnerData: failed clearing ${table}: ${error.message}`)
  }
}
