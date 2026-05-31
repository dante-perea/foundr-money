// src/lib/mcp/tools/ecosystem-spend.ts
//
// READ tool — ranked, whole-ecosystem burn summary for a period.
// Answers "what's my ecosystem burn this month?" with a per-product breakdown
// (sorted by expense desc) plus a portfolio total. Owner-scoped via ctx.
import 'server-only'
import { z } from 'zod'
import { portfolioPnl, PERIOD_LABELS, type Period } from '@/lib/money/pnl'
import { formatCents } from '@/lib/money/money'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { text, type MoneyToolCtx, type ToolResult } from './_shared'

const PERIODS = ['last30', 'mtd', 'ytd', 'all'] as const

export const ecosystemSpendInput = {
  period: z
    .enum(PERIODS)
    .optional()
    .describe('last30 (default) | mtd | ytd | all'),
}

export async function runEcosystemSpend(
  ctx: MoneyToolCtx,
  args: { period?: Period },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.read)

  const period: Period = args.period ?? 'last30'
  const rows = await portfolioPnl(ctx.ownerId, period)

  // Rank by burn (expense) descending — the founder wants the biggest cost
  // centres first. Stable tiebreak on net (most negative = most expensive net).
  const ranked = [...rows].sort((a, b) => {
    if (b.expense_cents !== a.expense_cents) return b.expense_cents - a.expense_cents
    return a.net_cents - b.net_cents
  })

  const totals = ranked.reduce(
    (acc, r) => {
      acc.expense_cents += r.expense_cents
      acc.income_cents += r.income_cents
      acc.mrr_cents += r.mrr_cents
      acc.txn_count += r.txn_count
      return acc
    },
    { expense_cents: 0, income_cents: 0, mrr_cents: 0, txn_count: 0 },
  )
  const totalNet = totals.income_cents - totals.expense_cents

  const periodLabel = PERIOD_LABELS[period]

  const structuredProjects = ranked.map((r) => ({
    project: r.project_name,
    slug: r.project_slug,
    is_personal: r.is_personal,
    expense_cents: r.expense_cents,
    net_cents: r.net_cents,
    mrr_cents: r.mrr_cents,
    income_cents: r.income_cents,
    txn_count: r.txn_count,
  }))

  const structuredTotal = {
    expense_cents: totals.expense_cents,
    income_cents: totals.income_cents,
    net_cents: totalNet,
    mrr_cents: totals.mrr_cents,
    txn_count: totals.txn_count,
    project_count: ranked.length,
  }

  const lines = ranked.map((r) => {
    const burn = formatCents(r.expense_cents, 'usd')
    const net = formatCents(r.net_cents, 'usd', { signed: true })
    const mrr = r.mrr_cents ? `, mrr ${formatCents(r.mrr_cents, 'usd')}` : ''
    return `• ${r.project_name}${r.is_personal ? ' (personal)' : ''}: burn ${burn}, net ${net}${mrr}`
  })

  const head = `Ecosystem burn — ${periodLabel} (${ranked.length} project${ranked.length === 1 ? '' : 's'})`
  const body = lines.length ? lines.join('\n') : '(no projects yet)'
  const totalLine = `Total: burn ${formatCents(totals.expense_cents, 'usd')}, net ${formatCents(
    totalNet,
    'usd',
    { signed: true },
  )}${totals.mrr_cents ? `, mrr ${formatCents(totals.mrr_cents, 'usd')}` : ''}`
  // Annotate large output so the agent reads structuredContent rather than the
  // text dump when the portfolio is big.
  const note =
    ranked.length > 12
      ? '\n\n(large output — see structuredContent.projects for the full machine-readable list)'
      : ''

  return text(`${head}\n\n${body}\n\n${totalLine}${note}`, {
    period,
    period_label: periodLabel,
    projects: structuredProjects,
    total: structuredTotal,
  })
}
