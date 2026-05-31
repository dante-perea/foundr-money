import 'server-only'
import { db } from '../db'
import { decrypt } from '../crypto'
import { ensurePersonalProject } from '../projects'
import { insertCanonicalTransaction } from '../transactions'
import type { RawTransaction } from '../types'

// ── Anthropic Cost ingestion adapter (DORMANT until an admin key exists) ───
//
// STATUS: this adapter is intentionally inert. It stays a guarded no-op until
// the founder provides an Anthropic ORGANIZATION ADMIN key (sk-ant-admin…),
// either persisted on a `financial_accounts` row (provider 'anthropic',
// kind 'provider_invoice') in the encrypted `credential_ref` column, or via the
// `ANTHROPIC_ADMIN_KEY` env var. With no key it returns
// `{ ok: false, error: 'anthropic_not_configured' }` and never throws — so the
// module imports cleanly and any cron/route that calls it returns clean JSON.
//
// It mirrors the Vercel FOCUS adapter (lib/money/ingest/vercel-focus.ts) and the
// OpenAI adapter (lib/money/ingest/openai-costs.ts):
//   1. pull the org's native per-workspace cost breakdown,
//   2. map each native workspace_id → a foundr project via external_project_map
//      (provider 'anthropic', external_id = workspace_id); unmapped rows fall
//      to Personal/Unallocated,
//   3. ingest each bucket as a canonical transaction (category_hint
//      'AI & compute') AND record one aggregate provider_invoices row.
//
// API (org-scoped Cost Report endpoint, requires an admin key + version header):
//   GET https://api.anthropic.com/v1/organizations/cost_report
//       ?group_by[]=workspace_id&starting_at=<ISO>&ending_at=<ISO>
//   Authorization: Bearer <admin key>
//   anthropic-version: 2023-06-01
// Response shape (paginated buckets):
//   { data: [ { starting_at, ending_at,
//               results: [ { amount, currency, workspace_id } ] } ],
//     has_more, next_page }
//
// SIGN: Anthropic `amount` is a POSITIVE cost (an expense) → matches our house
// convention (expense = positive), so we map straight across.

const COST_REPORT_ENDPOINT =
  process.env.ANTHROPIC_COST_URL || 'https://api.anthropic.com/v1/organizations/cost_report'
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01'

/** True only when an Anthropic org admin key is configured via env. (A key may
 *  also live on a financial_accounts.credential_ref row — resolveAnthropicAdminKey
 *  checks both; this fast path covers the env case for callers gating cheaply.) */
export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_ADMIN_KEY)
}

/** Resolve the Anthropic org admin key: prefer a per-owner encrypted credential
 *  on a financial_accounts row, else fall back to the ANTHROPIC_ADMIN_KEY env
 *  var. Returns null when neither is present (caller returns
 *  'anthropic_not_configured'). */
async function resolveAnthropicAdminKey(ownerId: string): Promise<string | null> {
  const { data } = await db()
    .from('financial_accounts')
    .select('credential_ref')
    .eq('owner_id', ownerId)
    .eq('provider', 'anthropic')
    .eq('kind', 'provider_invoice')
    .not('credential_ref', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const stored = (data as { credential_ref: string | null } | null)?.credential_ref ?? null
  if (stored) {
    try {
      return decrypt(stored)
    } catch {
      // Corrupt/undecryptable secret — fall through to env.
    }
  }
  return process.env.ANTHROPIC_ADMIN_KEY ?? null
}

interface AnthropicCostResult {
  amount?: number | string | null
  currency?: string | null
  workspace_id?: string | null
}

interface AnthropicCostBucket {
  starting_at?: string | null
  ending_at?: string | null
  results?: AnthropicCostResult[] | null
}

interface AnthropicCostResponse {
  data?: AnthropicCostBucket[] | null
  has_more?: boolean | null
  next_page?: string | null
}

function isoDay(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10)
  const slice = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : new Date().toISOString().slice(0, 10)
}

function resultToRaw(
  bucket: AnthropicCostBucket,
  res: AnthropicCostResult,
  accountRef: string,
  index: number,
): RawTransaction | null {
  const value = Number(res.amount ?? 0)
  if (!Number.isFinite(value) || value === 0) return null
  const amountCents = Math.round(value * 100)
  const start = isoDay(bucket.starting_at)
  const end = isoDay(bucket.ending_at)
  const workspaceId = res.workspace_id ?? 'unknown'
  return {
    external_id: `anthropic:${workspaceId}:${start}:${index}`,
    source: 'anthropic',
    account_ref: accountRef,
    amount_cents: amountCents,
    raw_amount_cents: amountCents,
    raw_sign_source: 'anthropic-cost-report',
    currency: (res.currency ?? 'usd').toLowerCase(),
    occurred_on: end,
    posted_on: end,
    merchant_hint: 'Anthropic',
    description: `Anthropic usage (${workspaceId})`,
    category_hint: 'AI & compute',
  }
}

export interface AnthropicIngestResult {
  ok: boolean
  rows: number
  ingested: number
  mapped: number
  error?: string
}

/** Ensure an Anthropic provider-invoice financial account exists for the owner. */
async function ensureAnthropicAccount(ownerId: string): Promise<string> {
  const existing = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('provider', 'anthropic')
    .eq('kind', 'provider_invoice')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const found = (existing.data as { id: string } | null)?.id
  if (found) return found
  const created = await db()
    .from('financial_accounts')
    .insert({
      owner_id: ownerId,
      provider: 'anthropic',
      kind: 'provider_invoice',
      display_name: 'Anthropic (usage)',
      status: 'active',
    })
    .select('id')
    .single()
  return (created.data as { id: string }).id
}

/** Map Anthropic's native workspace_id → a foundr project via
 *  external_project_map (provider 'anthropic'). */
async function mapAnthropicWorkspace(
  ownerId: string,
  workspaceId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(workspaceId)) return cache.get(workspaceId) ?? null
  const { data } = await db()
    .from('external_project_map')
    .select('project_id')
    .eq('owner_id', ownerId)
    .eq('provider', 'anthropic')
    .eq('external_id', workspaceId)
    .maybeSingle()
  const id = (data as { project_id: string } | null)?.project_id ?? null
  cache.set(workspaceId, id)
  return id
}

/**
 * Pull the Anthropic org Cost Report (grouped by workspace_id) and ingest it as
 * provider_invoices + canonical transactions, mapping each bucket to a foundr
 * project by its native Anthropic workspace_id (external_project_map, provider
 * 'anthropic'). Unmapped buckets fall to Personal/Unallocated.
 *
 * DORMANT until an admin key is configured: returns
 * { ok: false, error: 'anthropic_not_configured' } and never throws when no key
 * is present. Once the founder supplies a key (env or credential_ref), this
 * lights up with no further code change.
 *
 * @param windowDays how many days back to query (default 30).
 */
export async function fetchAndIngestAnthropicCosts(
  ownerId: string,
  opts: { windowDays?: number } = {},
): Promise<AnthropicIngestResult> {
  const result: AnthropicIngestResult = { ok: false, rows: 0, ingested: 0, mapped: 0 }
  const adminKey = await resolveAnthropicAdminKey(ownerId)
  if (!adminKey) {
    result.error = 'anthropic_not_configured'
    return result
  }

  try {
    const windowDays = opts.windowDays ?? 30
    const endingAt = new Date().toISOString()
    const startingAt = new Date(Date.now() - windowDays * 86_400_000).toISOString()

    const accountRef = await ensureAnthropicAccount(ownerId)
    const personal = await ensurePersonalProject(ownerId)
    const workspaceCache = new Map<string, string | null>()

    const lineItems: { description: string; amount_cents: number }[] = []
    let total = 0
    let index = 0
    let currency = 'usd'

    // Page through the cost buckets (cursor-based via next_page).
    let page: string | null = null
    let guard = 0
    do {
      const url = new URL(COST_REPORT_ENDPOINT)
      url.searchParams.append('group_by[]', 'workspace_id')
      url.searchParams.set('starting_at', startingAt)
      url.searchParams.set('ending_at', endingAt)
      if (page) url.searchParams.set('page', page)

      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${adminKey}`,
          'anthropic-version': ANTHROPIC_VERSION,
          Accept: 'application/json',
        },
      })
      if (!resp.ok) {
        result.error = `anthropic_cost_http_${resp.status}`
        return result
      }
      const body = (await resp.json()) as AnthropicCostResponse
      const buckets = body.data ?? []

      for (const bucket of buckets) {
        for (const res of bucket.results ?? []) {
          result.rows++
          const raw = resultToRaw(bucket, res, accountRef, index++)
          if (!raw) continue
          currency = raw.currency
          let projectId = personal.id
          if (res.workspace_id) {
            const mapped = await mapAnthropicWorkspace(ownerId, res.workspace_id, workspaceCache)
            if (mapped) {
              projectId = mapped
              result.mapped++
            }
          }
          await insertCanonicalTransaction(ownerId, raw, { projectId })
          result.ingested++
          lineItems.push({ description: raw.description ?? 'Anthropic', amount_cents: raw.amount_cents })
          total += raw.amount_cents
        }
      }

      page = body.has_more ? (body.next_page ?? null) : null
    } while (page && ++guard < 100)

    if (lineItems.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      await db()
        .from('provider_invoices')
        .insert({
          owner_id: ownerId,
          financial_account_id: accountRef,
          provider: 'anthropic',
          external_invoice_id: `anthropic-cost-${today}`,
          period_start: startingAt.slice(0, 10),
          period_end: today,
          total_cents: total,
          currency,
          line_items: lineItems,
        })
    }

    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'anthropic_cost_failed'
    return result
  }
}
