import 'server-only'
import { connection } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// `await connection()` before `auth()` — required under cacheComponents or the
// prerender phase rejects with HANGING_PROMISE_REJECTION.

export async function getOwnerId(): Promise<string | null> {
  // TEMP screenshot bypass (dev only; never set in prod) — REVERT before ship.
  if (process.env.SCREENSHOT_OWNER) return process.env.SCREENSHOT_OWNER
  await connection()
  const { userId } = await auth()
  return userId ?? null
}

export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId()
  if (!ownerId) throw new Error('UNAUTHENTICATED')
  return ownerId
}
