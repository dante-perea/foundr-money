import 'server-only'
import crypto from 'node:crypto'
import { db } from './db'
import { MCP_SCOPES } from './constants'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export interface AgentKeyRow {
  id: string
  label: string
  scopes: string[]
  status: string
  last_used_at: string | null
  created_at: string
}

/** Mint a new static MCP bearer (`fm_…`). The raw token is returned ONCE. */
export async function mintAgentKey(
  ownerId: string,
  label = 'default',
): Promise<{ token: string; id: string }> {
  const token = 'fm_' + crypto.randomBytes(24).toString('hex')
  const { data, error } = await db()
    .from('money_agent_keys')
    .insert({
      owner_id: ownerId,
      key_hash: hashToken(token),
      label,
      scopes: [MCP_SCOPES.read, MCP_SCOPES.write],
    })
    .select('id')
    .single()
  if (error) throw error
  return { token, id: (data as { id: string }).id }
}

export async function listAgentKeys(ownerId: string): Promise<AgentKeyRow[]> {
  const { data, error } = await db()
    .from('money_agent_keys')
    .select('id, label, scopes, status, last_used_at, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AgentKeyRow[]
}

export async function revokeAgentKey(ownerId: string, id: string): Promise<void> {
  await db().from('money_agent_keys').update({ status: 'revoked' }).eq('owner_id', ownerId).eq('id', id)
}

export interface VerifiedKey {
  ownerId: string
  keyId: string
  scopes: string[]
}

/** Verify a presented `fm_…` bearer. Returns null if unknown/revoked. */
export async function verifyAgentKey(token: string): Promise<VerifiedKey | null> {
  if (!token || !token.startsWith('fm_')) return null
  const { data, error } = await db()
    .from('money_agent_keys')
    .select('id, owner_id, scopes, status')
    .eq('key_hash', hashToken(token))
    .maybeSingle()
  if (error || !data) return null
  const row = data as { id: string; owner_id: string; scopes: string[]; status: string }
  if (row.status !== 'active') return null
  // Best-effort last-used stamp (don't block on it).
  void db().from('money_agent_keys').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  return { ownerId: row.owner_id, keyId: row.id, scopes: row.scopes }
}
