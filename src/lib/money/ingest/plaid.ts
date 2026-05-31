import 'server-only'
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type Transaction as PlaidTransaction,
} from 'plaid'
import { db } from '../db'
import { decrypt } from '../crypto'
import { ensurePersonalProject } from '../projects'
import { insertCanonicalTransaction } from '../transactions'
import type { RawTransaction } from '../types'

// ── Plaid ingestion adapter ──────────────────────────────────────────────
// Sandbox-real: real link-token / exchange / cursor-sync against the Plaid
// Sandbox. Guarded everywhere on missing creds so the module imports and the
// routes return clean JSON even when PLAID_CLIENT_ID / PLAID_SECRET are absent.
//
// SIGN: Plaid `amount` is POSITIVE when money LEAVES the account (an outflow /
// expense) and NEGATIVE for inflows (refunds, deposits, payments). That matches
// our house convention exactly (expense = positive), so we map straight across:
//   amount_cents = Math.round(txn.amount * 100)
// and record raw_sign_source 'plaid' so the original can be re-derived.

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
}

/** The Plaid environment basePath, defaulting to sandbox. */
export function plaidEnv(): string {
  const env = process.env.PLAID_ENV?.trim() || 'sandbox'
  return PlaidEnvironments[env] ?? PlaidEnvironments.sandbox
}

let _client: PlaidApi | null = null

/** Lazily-built Plaid API client. Throws only when called without creds — all
 * callers gate on plaidConfigured() first. */
export function plaidClient(): PlaidApi {
  if (_client) return _client
  if (!plaidConfigured()) {
    throw new Error('Plaid not configured (PLAID_CLIENT_ID / PLAID_SECRET missing)')
  }
  const config = new Configuration({
    basePath: plaidEnv(),
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  })
  _client = new PlaidApi(config)
  return _client
}

interface PlaidItemRow {
  item_id: string
  owner_id: string
  access_token: string
  cursor: string | null
}

/** Look up the foundr owner that owns a given Plaid item_id (webhook path). */
export async function ownerForPlaidItem(itemId: string): Promise<string | null> {
  const { data } = await db()
    .from('plaid_items')
    .select('owner_id')
    .eq('item_id', itemId)
    .maybeSingle()
  return (data as { owner_id: string } | null)?.owner_id ?? null
}

/** Resolve (or fall back to) the financial_accounts row a Plaid txn lands in.
 * Tries to match the specific plaid_account_id; otherwise uses any account for
 * the item; otherwise null (caller skips). */
async function resolveAccountId(
  ownerId: string,
  itemId: string,
  plaidAccountId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(plaidAccountId)) return cache.get(plaidAccountId) ?? null
  // Exact account match first.
  const exact = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('plaid_account_id', plaidAccountId)
    .maybeSingle()
  let id = (exact.data as { id: string } | null)?.id ?? null
  if (!id) {
    // Fall back to the item-level account row created at exchange time.
    const itemAcct = await db()
      .from('financial_accounts')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('plaid_item_id', itemId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    id = (itemAcct.data as { id: string } | null)?.id ?? null
  }
  cache.set(plaidAccountId, id)
  return id
}

function plaidTxnToRaw(
  txn: PlaidTransaction,
  accountRef: string,
): RawTransaction {
  // Plaid: positive = outflow (expense) → matches our convention directly.
  const amountCents = Math.round((txn.amount ?? 0) * 100)
  const pfc = txn.personal_finance_category ?? null
  return {
    external_id: txn.transaction_id,
    source: 'plaid',
    account_ref: accountRef,
    amount_cents: amountCents,
    raw_amount_cents: amountCents,
    raw_sign_source: 'plaid',
    currency: (txn.iso_currency_code ?? 'usd').toLowerCase(),
    occurred_on: txn.authorized_date ?? txn.date,
    posted_on: txn.date,
    merchant_hint: txn.merchant_name ?? txn.name ?? null,
    description: txn.name ?? null,
    pfc_primary: pfc?.primary ?? null,
    pfc_detailed: pfc?.detailed ?? null,
    pfc_confidence: pfc?.confidence_level ?? null,
    pending: txn.pending ?? false,
  }
}

export interface SyncResult {
  added: number
  modified: number
  removed: number
  cursor: string | null
  ok: boolean
  error?: string
}

/**
 * Cursor loop over /transactions/sync for a single Plaid item.
 * - added / modified → upsert into the canonical ledger as UNTAGGED (lands in
 *   the owner's Personal/Unallocated project; the classifier / in-loop tagging
 *   re-allocates later).
 * - removed → delete the matching canonical transaction (cascades allocations).
 * Persists the final next_cursor onto plaid_items.cursor so re-syncs are
 * incremental.
 */
export async function syncPlaidItem(ownerId: string, itemId: string): Promise<SyncResult> {
  const result: SyncResult = { added: 0, modified: 0, removed: 0, cursor: null, ok: false }
  if (!plaidConfigured()) {
    result.error = 'plaid_not_configured'
    return result
  }

  const { data: itemData, error: itemErr } = await db()
    .from('plaid_items')
    .select('item_id, owner_id, access_token, cursor')
    .eq('item_id', itemId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (itemErr || !itemData) {
    result.error = 'item_not_found'
    return result
  }
  const item = itemData as PlaidItemRow
  // Stored access_token is encrypted at rest — decrypt before use. (Degrades
  // safely for plaintext-marked / legacy rows; see lib/money/crypto.)
  const accessToken = decrypt(item.access_token)

  const personal = await ensurePersonalProject(ownerId)
  const acctCache = new Map<string, string | null>()
  const client = plaidClient()

  let cursor: string | undefined = item.cursor ?? undefined
  let hasMore = true
  try {
    while (hasMore) {
      const resp = await client.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 250,
      })
      const data = resp.data

      for (const txn of data.added) {
        const acct = await resolveAccountId(ownerId, itemId, txn.account_id, acctCache)
        if (!acct) continue
        await insertCanonicalTransaction(ownerId, plaidTxnToRaw(txn, acct), {
          projectId: personal.id,
        })
        result.added++
      }
      for (const txn of data.modified) {
        const acct = await resolveAccountId(ownerId, itemId, txn.account_id, acctCache)
        if (!acct) continue
        // insertCanonicalTransaction upserts on (account, external_id).
        await insertCanonicalTransaction(ownerId, plaidTxnToRaw(txn, acct), {
          projectId: personal.id,
        })
        result.modified++
      }
      for (const rem of data.removed) {
        if (!rem.transaction_id) continue
        await db()
          .from('transactions')
          .delete()
          .eq('owner_id', ownerId)
          .eq('external_id', rem.transaction_id)
        result.removed++
      }

      cursor = data.next_cursor
      hasMore = data.has_more
    }

    await db()
      .from('plaid_items')
      .update({ cursor: cursor ?? null, last_synced_at: new Date().toISOString() })
      .eq('item_id', itemId)
      .eq('owner_id', ownerId)

    // Touch the linked accounts' last_synced_at too.
    await db()
      .from('financial_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('plaid_item_id', itemId)

    result.cursor = cursor ?? null
    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'sync_failed'
    return result
  }
}
