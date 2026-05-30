// src/lib/mcp/tools/project-pnl.ts
//
// READ tool — per-project burn / income / net / MRR for a period.
import 'server-only'
import { z } from 'zod'
import { portfolioPnl, PERIOD_LABELS, type Period } from '@/lib/money/pnl'
import { formatCents } from '@/lib/money/money'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { resolveProject, text, type MoneyToolCtx, type ToolResult } from './_shared'

const PERIODS = ['last30', 'mtd', 'ytd', 'all'] as const

export const projectPnlInput = {
  project: z.string().describe('Project slug or id, or "all" for the whole portfolio'),
  period: z
    .enum(PERIODS)
    .optional()
    .describe('last30 (default) | mtd | ytd | all'),
}

export async function runProjectPnl(
  ctx: MoneyToolCtx,
  args: { project: string; period?: Period },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.read)

  const period: Period = args.period ?? 'last30'
  let rows = await portfolioPnl(ctx.ownerId, period)

  const wantAll = args.project.trim().toLowerCase() === 'all'
  if (!wantAll) {
    const project = await resolveProject(ctx.ownerId, args.project)
    if (!project) {
      return { ...text(`No project matching "${args.project}".`), isError: true }
    }
    rows = rows.filter((r) => r.project_id === project.id)
  }

  const periodLabel = PERIOD_LABELS[period]
  const structured = rows.map((r) => ({
    project: r.project_name,
    slug: r.project_slug,
    is_personal: r.is_personal,
    income_cents: r.income_cents,
    expense_cents: r.expense_cents,
    net_cents: r.net_cents,
    mrr_cents: r.mrr_cents,
    txn_count: r.txn_count,
  }))

  const lines = rows.map((r) => {
    const net = formatCents(r.net_cents, 'usd', { signed: true })
    const burn = formatCents(r.expense_cents, 'usd')
    const income = formatCents(r.income_cents, 'usd')
    const mrr = r.mrr_cents ? `  mrr ${formatCents(r.mrr_cents, 'usd')}` : ''
    return `• ${r.project_name}${r.is_personal ? ' (personal)' : ''}: burn ${burn}, income ${income}, net ${net}${mrr}  [${r.txn_count} txn]`
  })

  const head = wantAll
    ? `Portfolio P&L — ${periodLabel} (${rows.length} project${rows.length === 1 ? '' : 's'})`
    : `P&L — ${periodLabel}`
  const body = lines.length ? lines.join('\n') : '(no activity in this period)'
  // Annotate large output so the agent knows the structured payload is the
  // authoritative source rather than re-reading the text dump.
  const note = rows.length > 12 ? '\n\n(large output — see structuredContent.projects for the full machine-readable list)' : ''

  return text(`${head}\n\n${body}${note}`, { period, period_label: periodLabel, projects: structured })
}
