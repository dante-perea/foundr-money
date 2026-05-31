import 'server-only'
import { db } from '../db'
import { decrypt } from '../crypto'
import { ensurePersonalProject } from '../projects'
import { insertCanonicalTransaction } from '../transactions'
import type { RawTransaction } from '../types'

// ── OpenAI Costs ingestion adapter (DORMANT until an admin key exists) ─────
//
// STATUS: this adapter is intentionally inert. It stays a guarded no-op until
// the founder provides an OpenAI ORGANIZATION-LEVEL ADMIN key (sk-admin-…),
// either persisted on a `financial_accounts` row (provider 'openai',
// kind 'provider_invoice') in the encrypted `credential_ref` column, or via the
// `OPENAI_ADMIN_KEY` env var. With no key it returns
// `{ ok: false, error: 'openai_not_configured' }` and never throws — so the
// module imports cleanly and any cron/route that calls it returns clean JSON.
//
// It mirrors the Vercel FOCUS adapter (lib/money/ingest/vercel-focus.ts):
//   1. pull the provider's native per-project cost breakdown,
//   2. map each native project id → a foundr project via external_project_map
//      (provider 'openai'); unmapped rows fall to Personal/Unallocated,
//   3. ingest each bucket as a canonical transaction (category_hint
//      'AI & compute') AND record one aggregate provider_invoices row.
//
// API (org-scoped Costs endpoint, requires an admin key):
//   GET https://api.openai.com/v1/organization/costs
//       ?group_by[]=project_id&start_time=<unix>&end_time=<unix>
//   Authorization: Bearer <admin key>
// Response shape (paginated buckets):
//   { data: [ { start_time, end_time,
//               results: [ { amount: { value, currency }, project_id } ] } ],
//     has_more, next_page }
//
// SIGN: OpenAI `amount.value` is a POSITIVE cost (an expense) → matches our
// house convention (expense = positive), so we map straight across.

const COSTS_ENDPOINT =
  process.env.OPENAI_COSTS_URL || 'https://api.openai.com/v1/organization/costs'

/** True only when an OpenAI org admin key is configured via env. (A key may also
 *  live on a financial_accounts.credential_ref row — resolveOpenAIAdminKey
 *  checks both; this fast path covers the env case for callers gating cheaply.) */
export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_ADMIN_KEY)
}

/** Resolve the OpenAI org admin key: prefer a per-owner encrypted credential on
 *  a financial_accounts row, else fall back to the OPENAI_ADMIN_KEY env var.
 *  Returns null when neither is present (caller returns 'openai_not_configured'). */
async function resolveOpenAIAdminKey(ownerId: string): Promise<string | null> {
  const { data } = await db()
    .from('financial_accounts')
    .select('credential_ref')
    .eq('owner_id', ownerId)
    .eq('provider', 'openai')
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
  return process.env.OPENAI_ADMIN_KEY ?? null
}

interface OpenAICostResult {
  amount?: { value?: number | string | null; currency?: string | null } | null
  project_id?: string | null
}

interface OpenAICostBucket {
  start_time?: number | null
  end_time?: number | null
  results?: OpenAICostResult[] | null
}

interface OpenAICostsResponse {
  data?: OpenAICostBucket[] | null
  has_more?: boolean | null
  next_page?: string | null
}

function unixToDate(secs: number | null | undefined): string {
  if (!secs || !Number.isFinite(secs)) return new Date().toISOString().slice(0, 10)
  return new Date(secs * 1000).toISOString().slice(0, 10)
}

function resultToRaw(
  bucket: OpenAICostBucket,
  res: OpenAICostResult,
  accountRef: string,
  index: number,
): RawTransaction | null {
  const value = Number(res.amount?.value ?? 0)
  if (!Number.isFinite(value) || value === 0) return null
  const amountCents = Math.round(value * 100)
  const start = unixToDate(bucket.start_time)
  const end = unixToDate(bucket.end_time)
  const projectId = res.project_id ?? 'unknown'
  return {
    external_id: `openai:${projectId}:${start}:${index}`,
    source: 'openai',
    account_ref: accountRef,
    amount_cents: amountCents,
    raw_amount_cents: amountCents,
    raw_sign_source: 'openai-costs',
    currency: (res.amount?.currency ?? 'usd').toLowerCase(),
    occurred_on: end,
    posted_on: end,
    merchant_hint: 'OpenAI',
    description: `OpenAI usage (${projectId})`,
    category_hint: 'AI & compute',
  }
}

export interface OpenAIIngestResult {
  ok: boolean
  rows: number
  ingested: number
  mapped: number
  error?: string
}

/** Ensure an OpenAI provider-invoice financial account exists for the owner. */
async function ensureOpenAIAccount(ownerId: string): Promise<string> {
  const existing = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('provider', 'openai')
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
      provider: 'openai',
      kind: 'provider_invoice',
      display_name: 'OpenAI (usage)',
      status: 'active',
    })
    .select('id')
    .single()
  return (created.data as { id: string }).id
}

/** Map OpenAI's native project_id → a foundr project via external_project_map. */
async function mapOpenAIProject(
  ownerId: string,
  externalProjectId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(externalProjectId)) return cache.get(externalProjectId) ?? null
  const { data } = await db()
    .from('external_project_map')
    .select('project_id')
    .eq('owner_id', ownerId)
    .eq('provider', 'openai')
    .eq('external_id', externalProjectId)
    .maybeSingle()
  const id = (data as { project_id: string } | null)?.project_id ?? null
  cache.set(externalProjectId, id)
  return id
}

/**
 * Pull the OpenAI org Costs report (grouped by project_id) and ingest it as
 * provider_invoices + canonical transactions, mapping each bucket to a foundr
 * project by its native OpenAI project_id (external_project_map, provider
 * 'openai'). Unmapped buckets fall to Personal/Unallocated.
 *
 * DORMANT until an admin key is configured: returns
 * { ok: false, error: 'openai_not_configured' } and never throws when no key is
 * present. Once the founder supplies a key (env or credential_ref), this lights
 * up with no further code change.
 *
 * @param windowDays how many days back to query (default 30).
 */
export async function fetchAndIngestOpenAICosts(
  ownerId: string,
  opts: { windowDays?: number } = {},
): Promise<OpenAIIngestResult> {
  const result: OpenAIIngestResult = { ok: false, rows: 0, ingested: 0, mapped: 0 }
  const adminKey = await resolveOpenAIAdminKey(ownerId)
  if (!adminKey) {
    result.error = 'openai_not_configured'
    return result
  }

  try {
    const windowDays = opts.windowDays ?? 30
    const now = Math.floor(Date.now() / 1000)
    const startTime = now - windowDays * 86_400

    const accountRef = await ensureOpenAIAccount(ownerId)
    const personal = await ensurePersonalProject(ownerId)
    const projectCache = new Map<string, string | null>()

    const lineItems: { description: string; amount_cents: number }[] = []
    let total = 0
    let index = 0
    let currency = 'usd'

    // Page through the cost buckets (cursor-based via next_page).
    let page: string | null = null
    let guard = 0
    do {
      const url = new URL(COSTS_ENDPOINT)
      url.searchParams.append('group_by[]', 'project_id')
      url.searchParams.set('start_time', String(startTime))
      url.searchParams.set('end_time', String(now))
      if (page) url.searchParams.set('page', page)

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${adminKey}`, Accept: 'application/json' },
      })
      if (!resp.ok) {
        result.error = `openai_costs_http_${resp.status}`
        return result
      }
      const body = (await resp.json()) as OpenAICostsResponse
      const buckets = body.data ?? []

      for (const bucket of buckets) {
        for (const res of bucket.results ?? []) {
          result.rows++
          const raw = resultToRaw(bucket, res, accountRef, index++)
          if (!raw) continue
          currency = raw.currency
          let projectId = personal.id
          if (res.project_id) {
            const mapped = await mapOpenAIProject(ownerId, res.project_id, projectCache)
            if (mapped) {
              projectId = mapped
              result.mapped++
            }
          }
          await insertCanonicalTransaction(ownerId, raw, { projectId })
          result.ingested++
          lineItems.push({ description: raw.description ?? 'OpenAI', amount_cents: raw.amount_cents })
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
          provider: 'openai',
          external_invoice_id: `openai-costs-${today}`,
          period_start: unixToDate(startTime),
          period_end: today,
          total_cents: total,
          currency,
          line_items: lineItems,
        })
    }

    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'openai_costs_failed'
    return result
  }
}
