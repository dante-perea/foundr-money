'use server'

import { requireOwnerId } from '@/lib/money/owner'
import { mintAgentKey, revokeAgentKey } from '@/lib/money/agent-keys'

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
