import { db } from '@/lib/money/db'
import { fetchAndIngestVercelFocus } from '@/lib/money/ingest/vercel-focus'
import { reconcileAllInvoices } from '@/lib/money/ingest/reconcile'

// Daily Vercel FOCUS ingest cron (scheduled in /vercel.json at 08:00 UTC).
//
// cacheComponents-safe: reading the request's Authorization header is a runtime
// API, which automatically marks this route Dynamic — so NO `export const
// dynamic` / `export const runtime` (both banned under cacheComponents).
//
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. We reject any
// request that doesn't carry the matching bearer.

interface OwnerSyncSummary {
  owner: string
  ingested: number
  reconciled: number
  error?: string
}

/** Distinct owners with at least one connected account — the set to sync. */
async function ownersToSync(): Promise<string[]> {
  const { data, error } = await db()
    .from('financial_accounts')
    .select('owner_id')
  if (error || !data) return []
  const seen = new Set<string>()
  for (const row of data as { owner_id: string }[]) {
    if (row.owner_id) seen.add(row.owner_id)
  }
  return [...seen]
}

export async function GET(req: Request): Promise<Response> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const today = new Date()
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const from = monthStart.toISOString().slice(0, 10)
  const to = today.toISOString().slice(0, 10)

  const owners = await ownersToSync()
  const results: OwnerSyncSummary[] = []

  for (const owner of owners) {
    const summary: OwnerSyncSummary = { owner, ingested: 0, reconciled: 0 }
    try {
      const res = await fetchAndIngestVercelFocus(owner, from, to)
      summary.ingested = res?.ingested ?? 0
      if (res && !res.ok && res.error) summary.error = res.error
      const recon = await reconcileAllInvoices(owner)
      summary.reconciled = recon.filter((r) => r.reconciled).length
    } catch (err) {
      summary.error = err instanceof Error ? err.message : 'sync_failed'
    }
    results.push(summary)
  }

  return Response.json({
    ok: true,
    window: { from, to },
    owners: owners.length,
    results,
  })
}
