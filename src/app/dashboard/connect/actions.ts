'use server'

import { requireOwnerId } from '@/lib/money/owner'
import { mintAgentKey, revokeAgentKey } from '@/lib/money/agent-keys'
import { seedEcosystem } from '@/lib/money/ingest/ecosystem-seed'
import { fetchAndIngestVercelFocus } from '@/lib/money/ingest/vercel-focus'
import { reconcileAllInvoices } from '@/lib/money/ingest/reconcile'

/**
 * Mint a new static MCP bearer. The raw `fm_…` token is returned ONCE — the
 * client reveals it in a copyable box and warns it won't be shown again (only
 * the sha256 hash is stored). No revalidateTag: the client appends the new key
 * row optimistically and calls router.refresh() to reconcile.
 */
export async function mintKeyAction(label?: string): Promise<{ token: string; id: string }> {
  const owner = await requireOwnerId()
  const clean = label?.trim()
  const { token, id } = await mintAgentKey(owner, clean && clean.length > 0 ? clean : undefined)
  return { token, id }
}

/** Revoke an agent key (soft delete — status flips to 'revoked'). */
export async function revokeKeyAction(id: string): Promise<{ ok: true }> {
  const owner = await requireOwnerId()
  await revokeAgentKey(owner, id)
  return { ok: true }
}

export interface SyncEcosystemResult {
  ok: boolean
  /** foundr projects created/ensured for the ecosystem (incl. mappings). */
  projectsCreated: number
  /** canonical line items ingested from the Vercel FOCUS pull. */
  ingested: number
  /** non-fatal step errors — the action never throws on a single-step failure. */
  errors: string[]
}

/**
 * One-tap "Sync ecosystem spend": ensure every foundr.* project exists and is
 * mapped to its Vercel project id (seedEcosystem) → pull + ingest the real
 * Vercel FOCUS billing export (fetchAndIngestVercelFocus) → link each provider
 * invoice to its paying card charge (reconcileAllInvoices).
 *
 * No revalidateTag on this hot path — the client calls router.refresh() after
 * a successful sync to reconcile the server-rendered lists. We RETURN a small
 * authoritative summary the client surfaces inline.
 */
export async function syncEcosystemAction(): Promise<SyncEcosystemResult> {
  const owner = await requireOwnerId()
  const errors: string[] = []
  let projectsCreated = 0
  let ingested = 0

  // 1. Ensure the ecosystem projects + their vercel external_project_map rows.
  // seedEcosystem reports how many foundr projects it created/mapped; read the
  // count defensively so a sibling-slice return-shape tweak never breaks here.
  try {
    const seed = (await seedEcosystem(owner)) as { created?: number; projects?: number } | void
    projectsCreated = seed?.created ?? seed?.projects ?? 0
  } catch (err) {
    errors.push(`seed: ${err instanceof Error ? err.message : 'failed'}`)
  }

  // 2. Pull + ingest the real Vercel FOCUS export for the current month-to-date.
  try {
    const today = new Date()
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const from = monthStart.toISOString().slice(0, 10)
    const to = today.toISOString().slice(0, 10)
    const res = await fetchAndIngestVercelFocus(owner, from, to)
    ingested = res?.ingested ?? 0
    if (res && !res.ok && res.error) errors.push(`vercel: ${res.error}`)
  } catch (err) {
    errors.push(`vercel: ${err instanceof Error ? err.message : 'failed'}`)
  }

  // 3. Reconcile provider invoices against their paying card charges.
  try {
    await reconcileAllInvoices(owner)
  } catch (err) {
    errors.push(`reconcile: ${err instanceof Error ? err.message : 'failed'}`)
  }

  return { ok: errors.length === 0, projectsCreated, ingested, errors }
}
