// src/lib/mcp/tools/list-untagged.ts
//
// READ tool — charges that are still sitting in Personal / Unallocated.
import 'server-only'
import { z } from 'zod'
import { listUntagged } from '@/lib/money/transactions'
import { formatCents } from '@/lib/money/money'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { text, type MoneyToolCtx, type ToolResult } from './_shared'

export const listUntaggedInput = {
  since: z
    .string()
    .optional()
    .describe('ISO date (YYYY-MM-DD); only return charges posted on or after this date'),
  limit: z.number().int().min(1).max(200).optional().describe('Max rows to return (default 50)'),
}

export async function runListUntagged(
  ctx: MoneyToolCtx,
  args: { since?: string; limit?: number },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.read)

  const limit = args.limit ?? 50
  let rows = await listUntagged(ctx.ownerId, { limit })
  if (args.since) {
    rows = rows.filter((t) => t.posted_at >= args.since!)
  }

  const list = rows.map((t) => ({
    id: t.id,
    date: t.posted_at,
    merchant: t.merchant_name ?? t.description ?? '(no merchant)',
    amount: formatCents(t.amount_cents, t.currency, { signed: true }),
    amount_cents: t.amount_cents,
    account: t.account_name,
  }))

  if (list.length === 0) {
    return text('No untagged transactions — every charge is assigned to a project.', { untagged: [] })
  }

  const lines = list
    .map((r) => `• ${r.date}  ${r.amount.padStart(11)}  ${r.merchant} — ${r.account}  [${r.id}]`)
    .join('\n')
  const summary =
    `${list.length} untagged transaction${list.length === 1 ? '' : 's'} (still in Personal / Unallocated). ` +
    `Pass the bracketed id to tag_transaction.\n\n${lines}`
  return text(summary, { untagged: list })
}
