import 'server-only'
import { db } from './db'

// Demo-data lifecycle. ensureSeeded() (seed.ts) flags every row it writes with
// is_demo=true; this module reads that flag (hasDemoData) and tears it down
// cleanly (clearDemoData) so the onboarding promise — "sample data, clearly
// labeled, and removable" — is actually true.

/**
 * Does this owner currently have any sample data? Cheap, owner-scoped head
 * count against the indexed is_demo=true path. Checking transactions is the
 * authoritative signal (the demo always seeds transactions), but we also accept
 * seeded projects so the banner still fires if a founder somehow cleared txns
 * first.
 */
export async function hasDemoData(ownerId: string): Promise<boolean> {
  const { count } = await db()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('is_demo', true)
  if ((count ?? 0) > 0) return true

  const { count: projectCount } = await db()
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('is_demo', true)
  return (projectCount ?? 0) > 0
}

// Order matters: delete leaf/dependent rows before the projects they reference.
// transaction_allocations and tagging_feedback cascade from transactions (FK
// ON DELETE CASCADE), so deleting demo transactions clears them for free.
// projects is last because external_project_map / merchant_rules / stripe_subs /
// recurring_streams reference project_id.
const DEMO_TABLES_BEFORE_PROJECTS = [
  'transactions',
  'stripe_subscriptions',
  'recurring_streams',
  'external_project_map',
  'merchant_rules',
  'provider_invoices',
  'financial_accounts',
] as const

/**
 * Remove every sample row for this owner, then flip onboarding.used_sample_data
 * back to false so the demo banner stops showing. Leaves the founder's real
 * data — and the system Personal/Unallocated project — untouched. Idempotent:
 * a second call is a no-op.
 */
export async function clearDemoData(ownerId: string): Promise<void> {
  for (const table of DEMO_TABLES_BEFORE_PROJECTS) {
    const { error } = await db().from(table).delete().eq('owner_id', ownerId).eq('is_demo', true)
    if (error) throw error
  }

  // Seeded projects last (non-personal only — the flag already excludes Personal,
  // but is_demo=true is the precise predicate regardless).
  const { error: projErr } = await db()
    .from('projects')
    .delete()
    .eq('owner_id', ownerId)
    .eq('is_demo', true)
  if (projErr) throw projErr

  // The account is no longer "exploring with sample data".
  await db()
    .from('onboarding')
    .update({ used_sample_data: false })
    .eq('owner_id', ownerId)
}
