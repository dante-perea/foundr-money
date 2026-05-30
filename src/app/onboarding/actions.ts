'use server'

// Onboarding wizard server actions. Every mutation commits a REAL row the
// moment it succeeds and RETURNS the authoritative shape for optimistic commit
// on the client (the useOptimistic + confirmed-map pattern). No revalidateTag /
// updateTag on these hot mutations — projects/key/expense are real rows that the
// dashboard reloads fresh on navigation; adding cache invalidation here is the
// regression, not the fix.

import { redirect } from 'next/navigation'
import { requireOwnerId } from '@/lib/money/owner'
import {
  createProject as createProjectRow,
  listProjects,
  ensurePersonalProject,
  slugify,
} from '@/lib/money/projects'
import { mintAgentKey } from '@/lib/money/agent-keys'
import { insertCanonicalTransaction } from '@/lib/money/transactions'
import { ensureSeeded } from '@/lib/money/seed'
import { markOnboarded } from '@/lib/money/onboarding'
import { db } from '@/lib/money/db'
import { nextProjectColor } from '@/lib/money/palette'
import type { RawTransaction } from '@/lib/money/types'

/** A project as the wizard needs it (a thin view of the real row). */
export interface ProjectView {
  id: string
  name: string
  slug: string
  color: string
  isPersonal: boolean
  /** True if createProject hit the dedup path (slug already existed). */
  duplicate?: boolean
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Create a project. Auto-assigns the next palette color by current non-personal
 * count. Dedup is on (owner, slug) inside the lib — a DUPLICATE returns the
 * existing row and is treated as success. The `duplicate` flag lets the client
 * show a soft "already added" hint instead of a second row.
 */
export async function createProject(name: string): Promise<ProjectView> {
  const owner = await requireOwnerId()
  const clean = name.trim()
  if (!clean) throw new Error('EMPTY_NAME')

  const slug = slugify(clean)
  const before = await listProjects(owner)
  const existing = before.find((p) => p.slug === slug && !p.is_personal)
  const count = before.filter((p) => !p.is_personal).length

  const row = await createProjectRow(owner, { name: clean, color: nextProjectColor(count) })
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    isPersonal: row.is_personal,
    duplicate: Boolean(existing),
  }
}

/** Soft-delete a project added this session (status → archived). Personal is
 *  never removable. */
export async function removeProject(id: string): Promise<{ ok: true }> {
  const owner = await requireOwnerId()
  await db()
    .from('projects')
    .update({ status: 'archived' })
    .eq('owner_id', owner)
    .eq('id', id)
    .eq('is_personal', false)
  return { ok: true }
}

/** Inline rename of a session project. Returns the updated view. */
export async function renameProject(id: string, name: string): Promise<ProjectView> {
  const owner = await requireOwnerId()
  const clean = name.trim()
  if (!clean) throw new Error('EMPTY_NAME')
  const { data, error } = await db()
    .from('projects')
    .update({ name: clean })
    .eq('owner_id', owner)
    .eq('id', id)
    .eq('is_personal', false)
    .select('*')
    .single()
  if (error) throw error
  const row = data as { id: string; name: string; slug: string; color: string; is_personal: boolean }
  return { id: row.id, name: row.name, slug: row.slug, color: row.color, isPersonal: row.is_personal }
}

export interface MintedKey {
  id: string
  /** The full plaintext bearer — shown exactly once, never re-fetchable. */
  plaintext: string
  /** Display tail for the recap (no secret material). */
  last4: string
}

/**
 * Mint an `fm_…` MCP bearer. The raw token is returned ONCE; we keep only a
 * sha256 hash server-side. The client reveals + copies it, then drops it.
 */
export async function mintMcpKey(label?: string): Promise<MintedKey> {
  const owner = await requireOwnerId()
  const clean = label?.trim()
  const { token, id } = await mintAgentKey(owner, clean && clean.length > 0 ? clean : undefined)
  return { id, plaintext: token, last4: token.slice(-4) }
}

export interface AddedExpense {
  id: string
  merchant: string
  amountCents: number
  projectId: string
}

/**
 * The instant aha: one real expense, committed today in USD against a manual
 * "card" account (created/reused per founder). Expense amount is POSITIVE
 * (house sign convention). Allocated wholly to the chosen project.
 */
export async function addExpense(input: {
  merchant: string
  amountCents: number
  projectId: string
}): Promise<AddedExpense> {
  const owner = await requireOwnerId()
  const merchant = input.merchant.trim()
  if (!merchant) throw new Error('EMPTY_MERCHANT')
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) throw new Error('BAD_AMOUNT')

  // Find or create the founder's manual card account.
  const { data: existing } = await db()
    .from('financial_accounts')
    .select('id')
    .eq('owner_id', owner)
    .eq('provider', 'manual')
    .eq('kind', 'card')
    .maybeSingle()

  let accountId = (existing as { id: string } | null)?.id ?? null
  if (!accountId) {
    const { data: created, error } = await db()
      .from('financial_accounts')
      .insert({
        owner_id: owner,
        provider: 'manual',
        kind: 'card',
        display_name: 'Manual entries',
        status: 'active',
      })
      .select('id')
      .single()
    if (error) throw error
    accountId = (created as { id: string }).id
  }

  const day = todayISO()
  const raw: RawTransaction = {
    external_id: `manual-${owner}-${Date.now()}`,
    source: 'manual',
    account_ref: accountId,
    amount_cents: input.amountCents, // expense positive
    raw_amount_cents: input.amountCents,
    raw_sign_source: 'manual',
    currency: 'usd',
    occurred_on: day,
    posted_on: day,
    merchant_hint: merchant,
    description: 'Added during setup',
  }
  const id = await insertCanonicalTransaction(owner, raw, { projectId: input.projectId })
  return { id, merchant, amountCents: input.amountCents, projectId: input.projectId }
}

/**
 * Explore-with-sample-data fork. Idempotent demo seed (4–5 projects + a
 * believable cloud-heavy month) then mark onboarded with the sample flag and
 * redirect straight to the populated dashboard.
 */
export async function loadSampleData(): Promise<void> {
  const owner = await requireOwnerId()
  await ensureSeeded(owner)
  await markOnboarded(owner, { usedSampleData: true })
  redirect('/dashboard?demo=1')
}

/**
 * Best-effort "notify me" for the bank seam. There's no waitlist table yet, so
 * this never throws — it logs intent and returns ok. (When a table lands, swap
 * the body; the client contract stays.)
 */
export async function recordInterest(topic: string): Promise<{ ok: true }> {
  try {
    const owner = await requireOwnerId()
    console.info(`[onboarding] interest: ${topic} from ${owner}`)
  } catch {
    // ignore — a notify-me intent should never surface an error to the user
  }
  return { ok: true }
}

/**
 * Finish: stamp onboarded_at exactly once, then land on the dashboard. Used by
 * the Finish CTA and the global "Skip setup" escape hatch. Real projects, keys,
 * and the one expense are already committed — the dashboard is populated.
 */
export async function finishOnboarding(opts: { usedSampleData?: boolean } = {}): Promise<void> {
  const owner = await requireOwnerId()
  await ensurePersonalProject(owner) // guarantees the primitive always exists
  await markOnboarded(owner, { usedSampleData: opts.usedSampleData ?? false })
  redirect('/dashboard')
}
