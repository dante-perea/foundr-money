// src/lib/mcp/tools/tag-transaction.ts
//
// WRITE tool — assign a charge to a project (full, or a partial split where the
// remainder stays in Personal / Unallocated).
import 'server-only'
import { z } from 'zod'
import { getTransaction } from '@/lib/money/transactions'
import { retagTransaction, type AllocationInput } from '@/lib/money/allocations'
import { ensurePersonalProject } from '@/lib/money/projects'
import { formatCents } from '@/lib/money/money'
import { db } from '@/lib/money/db'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { resolveProject, text, type MoneyToolCtx, type ToolResult } from './_shared'

export const tagTransactionInput = {
  txn_id: z.string().describe('The transaction id (from list_untagged)'),
  project: z.string().describe('Target project — slug or id'),
  amount_cents: z
    .number()
    .int()
    .optional()
    .describe('Cents to allocate to the project; omit to tag the full charge. If less than the total, the remainder stays in Personal / Unallocated (a split).'),
  category: z.string().optional().describe('Optional category label or id (Schedule C line)'),
  note: z.string().optional().describe('Optional free-text note on the allocation'),
}

/** Resolve a category reference (label or id) to a category id, or null. */
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

export async function runTagTransaction(
  ctx: MoneyToolCtx,
  args: { txn_id: string; project: string; amount_cents?: number; category?: string; note?: string },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.write)

  const txn = await getTransaction(ctx.ownerId, args.txn_id)
  if (!txn) {
    return { ...text(`No transaction ${args.txn_id} for this owner.`), isError: true }
  }

  const project = await resolveProject(ctx.ownerId, args.project)
  if (!project) {
    return { ...text(`No project matching "${args.project}". Use create_project first, or pass an existing slug/id.`), isError: true }
  }

  const total = txn.amount_cents
  const categoryId = await resolveCategoryId(args.category)
  const allocations: AllocationInput[] = []

  // Same-sign + magnitude check: a partial allocation only makes sense when it
  // is the same sign as the total and strictly smaller in magnitude.
  const partialRequested =
    args.amount_cents !== undefined &&
    Math.sign(args.amount_cents) === Math.sign(total) &&
    Math.abs(args.amount_cents) < Math.abs(total)

  if (partialRequested) {
    const part = args.amount_cents!
    const remainder = total - part
    const personal = await ensurePersonalProject(ctx.ownerId)
    allocations.push({ projectId: project.id, amountCents: part, categoryId, note: args.note ?? null })
    allocations.push({ projectId: personal.id, amountCents: remainder })
  } else {
    // Full allocation (default, or when amount_cents == total / invalid partial).
    allocations.push({ projectId: project.id, amountCents: total, categoryId, note: args.note ?? null })
  }

  await retagTransaction(ctx.ownerId, args.txn_id, allocations)

  const merchant = txn.merchant_name ?? txn.description ?? 'charge'
  const allocSummary = allocations
    .map((a) => `${formatCents(a.amountCents, txn.currency, { signed: true })} → ${a.projectId === project.id ? project.name : 'Personal / Unallocated'}`)
    .join(', ')
  return text(
    `Tagged ${formatCents(total, txn.currency, { signed: true })} ${merchant}: ${allocSummary}.`,
    {
      transaction_id: txn.id,
      project_slug: project.slug,
      project_name: project.name,
      split: partialRequested,
      allocations: allocations.map((a) => ({
        project_id: a.projectId,
        amount_cents: a.amountCents,
        category_id: a.categoryId ?? null,
      })),
    },
  )
}
