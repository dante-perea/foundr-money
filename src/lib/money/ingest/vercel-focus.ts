import 'server-only'
import { db } from '../db'
import { ensurePersonalProject } from '../projects'
import { insertCanonicalTransaction } from '../transactions'
import type { RawTransaction } from '../types'

// ── Vercel FOCUS billing pull ──────────────────────────────────────────────
// Vercel exposes usage/cost in the FOCUS 1.0 schema (FinOps Open Cost &
// Usage Spec). The export is JSONL — one JSON object per cost record per line.
// We only need a team token (`VERCEL_TOKEN`, optionally `VERCEL_TEAM_ID`); no
// per-project credential dance — Vercel tags every record with the project.
//
// FOCUS columns we read:
//   • BilledCost   — the billed amount for the period (decimal, in BillingCurrency)
//   • BillingCurrency — ISO currency (e.g. "USD")
//   • ServiceName  — the Vercel product line (e.g. "Edge Functions", "Bandwidth")
//   • ChargePeriodStart / ChargePeriodEnd — ISO timestamps
//   • Tags.ProjectId / Tags.ProjectName — Vercel's NATIVE project identity, the
//     thing that makes per-project burn possible without manual tagging. We map
//     Tags.ProjectId → a foundr project via external_project_map (provider
//     'vercel'); unmapped rows land in Personal/Unallocated.
//
// Guarded on a missing token — fetchAndIngestVercelFocus returns a clean result
// object, never throws, when VERCEL_TOKEN is absent.

const FOCUS_ENDPOINT =
  process.env.VERCEL_FOCUS_URL || 'https://api.vercel.com/v1/installations/billing/focus'

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN)
}

interface FocusRow {
  BilledCost?: number | string | null
  EffectiveCost?: number | string | null
  BillingCurrency?: string | null
  ServiceName?: string | null
  ChargeDescription?: string | null
  ChargePeriodStart?: string | null
  ChargePeriodEnd?: string | null
  Tags?: Record<string, string> | null
  // Vercel sometimes flattens tags as `Tags.ProjectId` string keys:
  'Tags.ProjectId'?: string | null
  'Tags.ProjectName'?: string | null
}

function tagOf(row: FocusRow, key: 'ProjectId' | 'ProjectName'): string | null {
  const flat = row[`Tags.${key}` as `Tags.${typeof key}`]
  if (flat) return flat
  return row.Tags?.[key] ?? null
}

function focusRowToRaw(
  row: FocusRow,
  accountRef: string,
  index: number,
): RawTransaction | null {
  const billed = Number(row.BilledCost ?? row.EffectiveCost ?? 0)
  if (!Number.isFinite(billed) || billed === 0) return null
  // FOCUS BilledCost is a positive decimal for a cost (an expense) → matches
  // our expense-positive convention.
  const amountCents = Math.round(billed * 100)
  const start = (row.ChargePeriodStart ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  const end = (row.ChargePeriodEnd ?? '').slice(0, 10) || start
  const projectId = tagOf(row, 'ProjectId') ?? 'unknown'
  const service = row.ServiceName ?? 'Vercel'
  return {
    external_id: `vercel:${projectId}:${service}:${start}:${index}`,
    source: 'vercel',
    account_ref: accountRef,
    amount_cents: amountCents,
    raw_amount_cents: amountCents,
    raw_sign_source: 'vercel-focus',
    currency: (row.BillingCurrency ?? 'usd').toLowerCase(),
    occurred_on: end,
    posted_on: end,
    merchant_hint: 'Vercel',
    description: row.ChargeDescription ?? service,
    category_hint: 'Software & SaaS',
  }
}

/** Parse a JSONL FOCUS body into rows (tolerant of blank lines / trailing). */
export function parseFocusJsonl(body: string): FocusRow[] {
  const rows: FocusRow[] = []
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const parsed = JSON.parse(t)
      // A FOCUS export may also be a single { data: [...] } envelope.
      if (Array.isArray(parsed)) rows.push(...parsed)
      else if (parsed && Array.isArray(parsed.data)) rows.push(...parsed.data)
      else rows.push(parsed)
    } catch {
      // skip malformed line
    }
  }
  return rows
}

export interface VercelIngestResult {
  ok: boolean
  rows: number
  ingested: number
  mapped: number
  error?: string
}

/** Ensure a Vercel provider-invoice financial account exists for the owner. */
async function ensureVercelAccount(ownerId: string): Promise<string> {
  const existing = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('provider', 'vercel')
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
      provider: 'vercel',
      kind: 'provider_invoice',
      display_name: 'Vercel (usage)',
      status: 'active',
    })
    .select('id')
    .single()
  return (created.data as { id: string }).id
}

/** Map Vercel's native ProjectId → a foundr project via external_project_map. */
async function mapVercelProject(
  ownerId: string,
  externalProjectId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(externalProjectId)) return cache.get(externalProjectId) ?? null
  const { data } = await db()
    .from('external_project_map')
    .select('project_id')
    .eq('owner_id', ownerId)
    .eq('provider', 'vercel')
    .eq('external_id', externalProjectId)
    .maybeSingle()
  const id = (data as { project_id: string } | null)?.project_id ?? null
  cache.set(externalProjectId, id)
  return id
}

/**
 * Pull the Vercel FOCUS billing export and ingest it as provider_invoices +
 * canonical transactions, mapping each record to a foundr project by its native
 * Vercel ProjectId (external_project_map). Unmapped records fall to Personal.
 */
export async function fetchAndIngestVercelFocus(
  ownerId: string,
  token?: string,
): Promise<VercelIngestResult> {
  const result: VercelIngestResult = { ok: false, rows: 0, ingested: 0, mapped: 0 }
  const authToken = token ?? process.env.VERCEL_TOKEN
  if (!authToken) {
    result.error = 'vercel_not_configured'
    return result
  }

  try {
    const url = new URL(FOCUS_ENDPOINT)
    if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID)
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/x-ndjson, application/json' },
    })
    if (!resp.ok) {
      result.error = `vercel_focus_http_${resp.status}`
      return result
    }
    const body = await resp.text()
    const rows = parseFocusJsonl(body)
    result.rows = rows.length
    if (rows.length === 0) {
      result.ok = true
      return result
    }

    const accountRef = await ensureVercelAccount(ownerId)
    const personal = await ensurePersonalProject(ownerId)
    const projectCache = new Map<string, string | null>()

    // Aggregate one provider_invoices row for the pull (line items = services).
    const lineItems: { description: string; amount_cents: number }[] = []
    let total = 0

    let index = 0
    for (const row of rows) {
      const raw = focusRowToRaw(row, accountRef, index++)
      if (!raw) continue
      const externalProjectId = tagOf(row, 'ProjectId')
      let projectId = personal.id
      if (externalProjectId) {
        const mapped = await mapVercelProject(ownerId, externalProjectId, projectCache)
        if (mapped) {
          projectId = mapped
          result.mapped++
        }
      }
      await insertCanonicalTransaction(ownerId, raw, { projectId })
      result.ingested++
      lineItems.push({ description: raw.description ?? 'Vercel', amount_cents: raw.amount_cents })
      total += raw.amount_cents
    }

    if (lineItems.length > 0) {
      await db()
        .from('provider_invoices')
        .insert({
          owner_id: ownerId,
          financial_account_id: accountRef,
          provider: 'vercel',
          external_invoice_id: `vercel-focus-${new Date().toISOString().slice(0, 10)}`,
          period_start: new Date().toISOString().slice(0, 10),
          period_end: new Date().toISOString().slice(0, 10),
          total_cents: total,
          line_items: lineItems,
        })
    }

    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'vercel_focus_failed'
    return result
  }
}
