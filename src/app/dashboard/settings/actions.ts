'use server'

// Settings server actions: disconnect one account, or erase everything. Both
// are owner-scoped in the lib layer (requireOwnerId → owner threaded into every
// statement). disconnectAccountAction returns the surviving account list so the
// client commits it optimistically (the repo's return-the-row pattern — no
// revalidateTag/updateTag on the hot path). deleteAllDataAction redirects, so it
// never returns to the client.

import { redirect } from 'next/navigation'
import { requireOwnerId } from '@/lib/money/owner'
import { disconnectAccount, deleteAllOwnerData } from '@/lib/money/account'

/**
 * Disconnect a single financial account (deletes it + cascades its
 * transactions/allocations). Owner-scoped in the lib. Returns `{ ok: true }`;
 * the client removes the row from its optimistic list and reconciles on the
 * next navigation/reload.
 */
export async function disconnectAccountAction(accountId: string): Promise<{ ok: true }> {
  const owner = await requireOwnerId()
  await disconnectAccount(owner, accountId)
  return { ok: true }
}

/**
 * Erase ALL owner-scoped data, then send the founder back through onboarding so
 * they start from a clean workspace. The typed-confirm gate lives in the client;
 * we re-validate the literal here as defense-in-depth before doing anything
 * destructive. `redirect()` throws control flow, so nothing returns on success.
 */
export async function deleteAllDataAction(confirmation: string): Promise<void> {
  const owner = await requireOwnerId()
  if (confirmation.trim().toLowerCase() !== 'delete') {
    throw new Error('CONFIRMATION_REQUIRED')
  }
  await deleteAllOwnerData(owner)
  redirect('/onboarding')
}
