'use server'

// Dashboard demo-data actions. clearDemoDataAction tears down the sample seed
// for the current owner and reports ok; the client (DemoBanner) refreshes the
// route on success so the dashboard re-renders into its real (empty) state.
// No revalidateTag here — the dashboard reads owner-scoped DB rows fresh on
// every render, so router.refresh() after the delete is the whole story.

import { requireOwnerId } from '@/lib/money/owner'
import { clearDemoData } from '@/lib/money/demo'

export async function clearDemoDataAction(): Promise<{ ok: true }> {
  const owner = await requireOwnerId()
  await clearDemoData(owner)
  return { ok: true }
}
