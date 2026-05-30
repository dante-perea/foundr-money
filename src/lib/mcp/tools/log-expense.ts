// src/lib/mcp/tools/log-expense.ts
//
// WRITE tool — record a manual expense (cash, reimbursement, anything not on a
// connected account) straight against a project.
import 'server-only'
import { z } from 'zod'
import { insertCanonicalTransaction } from '@/lib/money/transactions'
import { ensurePersonalProject } from '@/lib/money/projects'
import { dollarsToCents, formatCents } from '@/lib/money/money'
import { db } from '@/lib/money/db'
import type { RawTransaction } from '@/lib/money/types'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { ensureManualAccount, resolveProject, text, type MoneyToolCtx, type ToolResult } from './_shared'

export const logExpenseInput = {
  amount: z.number().positive().describe('Expense amount in dollars (positive), e.g. 42.50'),
  project: z.string().describe('Project slug or id to bill it to (defaults to Personal if unknown)'),
  vendor: z.string().min(1).describe('Who was paid, e.g. "Notion" or "AWS"'),
  occurred_at: z.string().optional().describe('ISO date (YYYY-MM-DD); defaults to today'),
  category: z.string().optional().describe('Optional category label or id (Schedule C line)'),
}

async function resolveCategoryId(ref: string | undefined): Promise<string | null> {
  if (!ref) return null
  const trimmed = ref.trim()
  const { data } = await db().from('categories').select('id, label').is('owner_id', null)
  const cats = (data ?? []) as { id: string; label: string }[]
  const byId = cats.find((c) => c.id === trimmed)
  if (byId) return byId.id
  const byLabel = cats.find((c) => c.label.toLowerCase() === trimmed.toLowerCase())
  return byLabel ? byLabel.id : null
}

export async function runLogExpense(
  ctx: MoneyToolCtx,
  args: { amount: number; project: string; vendor: string; occurred_at?: string; category?: string },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.write)

  const project = (await resolveProject(ctx.ownerId, args.project)) ?? (await ensurePersonalProject(ctx.ownerId))
  const accountId = await ensureManualAccount(ctx.ownerId)
  const categoryId = await resolveCategoryId(args.category)

  const today = new Date().toISOString().slice(0, 10)
  const occurred = args.occurred_at ?? today
  const amountCents = dollarsToCents(args.amount) // expense = positive (house convention)

  const raw: RawTransaction = {
    external_id: `manual:${ctx.ownerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    source: 'manual',
    account_ref: accountId,
    amount_cents: amountCents,
    raw_amount_cents: amountCents,
    raw_sign_source: 'manual',
    currency: 'usd',
    occurred_on: occurred,
    posted_on: occurred,
    merchant_hint: args.vendor,
    description: `Manual expense — ${args.vendor}`,
    pending: false,
  }

  const txnId = await insertCanonicalTransaction(ctx.ownerId, raw, { projectId: project.id, categoryId })

  return text(
    `Logged ${formatCents(amountCents, 'usd')} to ${args.vendor} → ${project.name} (${occurred}).`,
    {
      transaction_id: txnId,
      amount_cents: amountCents,
      project_id: project.id,
      project_slug: project.slug,
      vendor: args.vendor,
      occurred_at: occurred,
      category_id: categoryId,
    },
  )
}
