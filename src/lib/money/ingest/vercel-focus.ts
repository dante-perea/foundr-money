import 'server-only'
import { db } from '../db'
import { createProject, getProjectBySlug } from '../projects'
import { insertCanonicalTransaction } from '../transactions'
import type { Project, RawTransaction } from '../types'

// ── Vercel FOCUS billing pull ──────────────────────────────────────────────
// Vercel exposes usage/cost in the FOCUS 1.0 schema (FinOps Open Cost &
// Usage Spec) via GET /v1/billing/charges. The export is JSONL — one FOCUS
// record per line. We only need a team token (`VERCEL_TOKEN`) + the team id
// (`VERCEL_TEAM_ID`); no per-project credential dance — Vercel tags most
// records with the project (`Tags.ProjectId` / `Tags.ProjectName`).
//
// The window is REQUIRED: `from` and `to` are ISO `YYYY-MM-DD`. An empty or
// future window returns 404 — we treat that as a clean empty result.
//
// FOCUS columns we read:
//   • BilledCost     — the BILLED amount (decimal). Under the Pro plan most
//                      rows BilledCost===0 (the usage is inside the plan) — so
//                      BilledCost alone is NOT a usable per-project signal.
//   • EffectiveCost  — the amortized/true consumption cost. THIS is the
//                      per-project burn signal we key the canonical amount on.
//   • BillingCurrency — ISO currency (e.g. "USD")
//   • ServiceName     — Vercel product line (e.g. "Edge Functions", "Bandwidth")
//   • ServiceCategory / ChargeCategory — FOCUS taxonomy (kept in the description
//                       + folded into the stable external_id so a project's
//                       Usage vs. Purchase vs. Tax rows don't collide).
//   • ChargePeriodStart / ChargePeriodEnd — ISO timestamps for the line's window
//   • Tags.ProjectId / Tags.ProjectName — Vercel's NATIVE project identity, the
//     thing that makes per-project burn possible without manual tagging. We map
//     Tags.ProjectId → a foundr project via external_project_map (provider
//     'vercel'). Rows with empty Tags ({}) are team-level (the $4.50 Pro fee,
//     Speed Insights, Blob, …) → routed to an 'Unallocated / Platform' project.
//
// Guarded on a missing token — fetchAndIngestVercelFocus returns a clean result
// object, never throws, when VERCEL_TOKEN is absent.

const FOCUS_ENDPOINT =
  process.env.VERCEL_FOCUS_URL || 'https://api.vercel.com/v1/billing/charges'

const UNALLOCATED_SLUG = 'unallocated'
const UNALLOCATED_NAME = 'Unallocated / Platform'

// Schedule-C-mapped system category for hosting/infra spend. 'Infrastructure'
// is not a seeded category; 'Software & SaaS' (L27a) is the closest fit.
const VERCEL_CATEGORY_LABEL = 'Software & SaaS'

export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN)
}

interface FocusRow {
  BilledCost?: number | string | null
  EffectiveCost?: number | string | null
  BillingCurrency?: string | null
  ServiceName?: string | null
  ServiceCategory?: string | null
  ChargeCategory?: string | null
  ChargeDescription?: string | null
  ChargePeriodStart?: string | null
  ChargePeriodEnd?: string | null
  ConsumedQuantity?: number | string | null
  ConsumedUnit?: string | null
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

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Today, as a UTC YYYY-MM-DD string. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** First day of the current UTC month, as YYYY-MM-DD. */
function monthStartUtc(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

/**
 * Map ONE FOCUS row into a canonical RawTransaction. Returns null only when the
 * row carries NO consumption signal at all (both BilledCost and EffectiveCost
 * are 0) — those are noise. Otherwise:
 *   • amount_cents     ← EffectiveCost (the true per-project consumption signal)
 *   • raw_amount_cents ← BilledCost    (what actually hit the invoice; $0 under Pro)
 * Both stay expense-positive (FOCUS costs are positive decimals for spend).
 *
 * The external_id is WINDOW-coarse, NOT per-day: every (project, service,
 * category) row in the pulled window collapses onto the SAME external_id so the
 * ingest loop can SUM the per-row amounts into one canonical event before the
 * insert (see fetchAndIngestVercelFocus). A per-day id would (a) explode the
 * insert count toward the ~38k raw rows and (b) make fm_insert_transaction's
 * UPSERT overwrite rather than accumulate same-day rows. occurred_on/posted_on
 * are pinned to the window end so the summed event lands on a single date.
 */
function focusRowToRaw(
  row: FocusRow,
  accountRef: string,
  /** Category LABEL (e.g. 'Software & SaaS') for the classifier hint — NOT the id. */
  categoryHint: string | null,
  /** Window start, ISO YYYY-MM-DD — folded into the external_id. */
  windowFrom: string,
  /** Window end, ISO YYYY-MM-DD — folded into the external_id + used as the date. */
  windowTo: string,
): RawTransaction | null {
  const effective = num(row.EffectiveCost)
  const billed = num(row.BilledCost)
  // Skip ONLY when there is no cost on either axis.
  if (effective === 0 && billed === 0) return null

  // EffectiveCost is the primary amount (the consumption signal); BilledCost is
  // the raw (what was actually invoiced — often $0 under the Pro plan).
  const amountCents = Math.round(effective * 100)
  const rawAmountCents = Math.round(billed * 100)

  const projectId = tagOf(row, 'ProjectId') ?? 'platform'
  const service = row.ServiceName ?? 'Vercel'
  const chargeCategory = row.ChargeCategory ?? 'Usage'

  // Stable, deterministic, WINDOW-based external_id — NOT per-day. All rows for a
  // given (project, service, category) within the pulled window share this id so
  // the ingest loop sums them into ONE canonical economic event; re-pulling the
  // same window upserts (replaces) that single summed row rather than duplicating.
  const externalId = `vercel:${windowFrom}_${windowTo}:${projectId}:${service}:${chargeCategory}`

  const qty = num(row.ConsumedQuantity)
  const unit = row.ConsumedUnit?.trim()
  const descBase = row.ChargeDescription ?? service
  const description =
    qty > 0 && unit ? `${descBase} (${qty} ${unit})` : descBase

  return {
    external_id: externalId,
    source: 'vercel',
    account_ref: accountRef,
    amount_cents: amountCents,
    raw_amount_cents: rawAmountCents,
    raw_sign_source: 'vercel-focus',
    currency: (row.BillingCurrency ?? 'usd').toLowerCase(),
    occurred_on: windowTo,
    posted_on: windowTo,
    merchant_hint: 'Vercel',
    description,
    category_hint: categoryHint,
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
  /** Rows routed to the Unallocated / Platform project (team-level / unmapped). */
  unallocated: number
  from?: string
  to?: string
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

/**
 * The catch-all project for team-level / unmapped Vercel spend (the $4.50 Pro
 * fee, Speed Insights, Blob, and any project not yet in external_project_map).
 * NOT the Personal project — this is explicitly a platform bucket so it reads
 * correctly in the per-project P&L.
 */
async function ensureUnallocatedProject(ownerId: string): Promise<Project> {
  const existing = await getProjectBySlug(ownerId, UNALLOCATED_SLUG)
  if (existing) return existing
  return createProject(ownerId, {
    name: UNALLOCATED_NAME,
    slug: UNALLOCATED_SLUG,
    color: '#64748b',
    description: 'Team-level platform spend not attributable to a single project.',
  })
}

/** Resolve a system category by label → its id (system rows have owner_id null). */
async function resolveCategoryId(label: string): Promise<string | null> {
  const { data } = await db()
    .from('categories')
    .select('id')
    .is('owner_id', null)
    .eq('label', label)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
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
 * Pull the Vercel FOCUS billing export for a window and ingest it as a
 * provider_invoices row + canonical transactions, mapping each record to a
 * foundr project by its native Vercel ProjectId (external_project_map). Rows
 * with empty/unmapped Tags fall to the 'Unallocated / Platform' project.
 *
 * @param from inclusive window start, ISO YYYY-MM-DD. Default: current month-to-date.
 * @param to   inclusive window end, ISO YYYY-MM-DD. Default: today (UTC).
 */
export async function fetchAndIngestVercelFocus(
  ownerId: string,
  from?: string,
  to?: string,
  token?: string,
): Promise<VercelIngestResult> {
  const windowFrom = from ?? monthStartUtc()
  const windowTo = to ?? todayUtc()
  const result: VercelIngestResult = {
    ok: false,
    rows: 0,
    ingested: 0,
    mapped: 0,
    unallocated: 0,
    from: windowFrom,
    to: windowTo,
  }
  const authToken = token ?? process.env.VERCEL_TOKEN
  if (!authToken) {
    result.error = 'vercel_not_configured'
    return result
  }

  try {
    const url = new URL(FOCUS_ENDPOINT)
    // from/to are REQUIRED by /v1/billing/charges.
    url.searchParams.set('from', windowFrom)
    url.searchParams.set('to', windowTo)
    if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID)

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/x-ndjson, application/json',
      },
    })
    // An empty / future window returns 404 — that is a clean empty result, not
    // a failure. Surface other HTTP errors.
    if (resp.status === 404) {
      result.ok = true
      return result
    }
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
    const unallocated = await ensureUnallocatedProject(ownerId)
    // Resolved category UUID drives the allocation; the LABEL drives the hint.
    const categoryId = await resolveCategoryId(VERCEL_CATEGORY_LABEL)
    const categoryHint = categoryId ? VERCEL_CATEGORY_LABEL : null
    const projectCache = new Map<string, string | null>()

    // Aggregate one provider_invoices row for this window. Each line item keeps
    // the Vercel ProjectId so the invoice is project-attributable downstream.
    const lineItems: {
      description: string
      amount_cents: number
      raw_amount_cents: number
      project_id: string | null
    }[] = []
    // Track the project ids actually touched so the invoice can carry a sensible
    // external_project_ref (single-project window → that project; mixed → null).
    const touchedExternalProjects = new Set<string>()
    let total = 0

    // ── Phase 1: AGGREGATE before inserting ──────────────────────────────────
    // The raw FOCUS export is window-coarse but row-fine: ~38k rows, one per
    // (project, service, category, DAY, sub-meter). Inserting per row would (a)
    // fire ~38k RPC round-trips → timeout, and (b) collide on a window-based
    // external_id where fm_insert_transaction UPSERTS — so we'd keep only the
    // LAST row's amount instead of the sum, badly undercounting per-project burn.
    //
    // Instead we collapse all rows sharing an external_id into ONE entry, SUMMING
    // amount_cents + raw_amount_cents. This drops ~38k rows → one entry per
    // (project, service, category) for the window (~hundreds). The Vercel
    // ProjectId ('ext') is captured once from the first row of each group — it is
    // invariant within a group since it is part of the external_id key.
    const groups = new Map<string, { raw: RawTransaction; ext: string | null }>()
    for (const row of rows) {
      const raw = focusRowToRaw(row, accountRef, categoryHint, windowFrom, windowTo)
      if (!raw) continue
      const existing = groups.get(raw.external_id)
      if (existing) {
        existing.raw.amount_cents += raw.amount_cents
        existing.raw.raw_amount_cents += raw.raw_amount_cents
      } else {
        groups.set(raw.external_id, { raw, ext: tagOf(row, 'ProjectId') })
      }
    }

    // ── Phase 2: insert ONCE per aggregated entry ────────────────────────────
    // Counts (ingested/mapped/unallocated) are tracked at the AGGREGATED grain —
    // one canonical transaction per (project, service, category) for the window.
    for (const { raw, ext } of groups.values()) {
      let projectId = unallocated.id
      if (ext) {
        const mapped = await mapVercelProject(ownerId, ext, projectCache)
        if (mapped) {
          projectId = mapped
          result.mapped++
          touchedExternalProjects.add(ext)
        } else {
          // Tagged but not yet mapped → Unallocated / Platform.
          result.unallocated++
        }
      } else {
        // Empty Tags ({}) → team-level platform spend.
        result.unallocated++
      }

      await insertCanonicalTransaction(ownerId, raw, { projectId, categoryId })
      result.ingested++
      lineItems.push({
        description: raw.description ?? 'Vercel',
        amount_cents: raw.amount_cents,
        raw_amount_cents: raw.raw_amount_cents,
        project_id: ext,
      })
      total += raw.amount_cents
    }

    if (lineItems.length > 0) {
      const externalProjectRef =
        touchedExternalProjects.size === 1 ? [...touchedExternalProjects][0] : null
      await db()
        .from('provider_invoices')
        .insert({
          owner_id: ownerId,
          financial_account_id: accountRef,
          provider: 'vercel',
          external_invoice_id: `vercel-focus-${windowFrom}_${windowTo}`,
          // The ACTUAL window — not today.
          period_start: windowFrom,
          period_end: windowTo,
          total_cents: total,
          line_items: lineItems,
          external_project_ref: externalProjectRef,
        })
    }

    result.ok = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'vercel_focus_failed'
    return result
  }
}
