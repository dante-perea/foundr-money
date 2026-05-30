import 'server-only'
import { connection } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// `await connection()` before `auth()` — required under cacheComponents or the
// prerender phase rejects with HANGING_PROMISE_REJECTION.

export async function getOwnerId(): Promise<string | null> {
  await connection()
  const { userId } = await auth()
  return userId ?? null
}

export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId()
  if (!ownerId) throw new Error('UNAUTHENTICATED')
  return ownerId
}
