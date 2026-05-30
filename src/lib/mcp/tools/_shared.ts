// src/lib/mcp/tools/_shared.ts
//
// Shared context + result helpers for foundr.money MCP tools.
// Every tool derives ownerId from `ctx` (NEVER from tool args) and audit-logs
// each call into mcp_call_log.
import 'server-only'
import { db } from '@/lib/money/db'
import type { Project } from '@/lib/money/types'
import { getProjectBySlug } from '@/lib/money/projects'

/** Per-call context, built once per request from the verified bearer. */
export interface MoneyToolCtx {
  ownerId: string
  keyId: string
  scopes: string[]
}

/** The shape the MCP SDK expects back from a tool callback. */
export interface ToolResult {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export function text(s: string, structured?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: s }], ...(structured ? { structuredContent: structured } : {}) }
}

/** Audit-log a single tool invocation. Best-effort: never throws into the call. */
export async function auditLog(input: {
  ownerId: string
  keyId: string
  toolName: string
  requestPayload: unknown
  status: 'ok' | 'error'
  latencyMs: number
}): Promise<void> {
  try {
    await db()
      .from('mcp_call_log')
      .insert({
        owner_id: input.ownerId,
        agent_key_id: input.keyId,
        tool_name: input.toolName,
        request_payload: (input.requestPayload ?? {}) as Record<string, unknown>,
        status: input.status,
        latency_ms: input.latencyMs,
      })
  } catch {
    // Logging must never break a tool call.
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolve a project reference (slug OR uuid) to a Project, owner-scoped. */
export async function resolveProject(ownerId: string, ref: string): Promise<Project | null> {
  const trimmed = ref.trim()
  if (UUID_RE.test(trimmed)) {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('id', trimmed)
      .maybeSingle()
    if (error) throw error
    if (data) return data as Project
    // Fall through: maybe they passed a slug that happens to look uuid-ish.
  }
  return getProjectBySlug(ownerId, trimmed)
}

/** Find (or create) the owner's manual-entry financial account for log_expense. */
export async function ensureManualAccount(ownerId: string): Promise<string> {
  const { data: existing, error } = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('provider', 'manual')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (existing) return (existing as { id: string }).id

  const { data: created, error: insErr } = await db()
    .from('financial_accounts')
    .insert({
      owner_id: ownerId,
      provider: 'manual',
      kind: 'card',
      display_name: 'Manual entries',
      currency: 'usd',
      status: 'active',
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return (created as { id: string }).id
}
