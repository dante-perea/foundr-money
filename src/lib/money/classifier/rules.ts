import 'server-only'
import { db } from '../db'
import { normalizeMerchant } from '../money'
import type { ClassifyResult } from './index'

/**
 * Leg 1 of the cascade: exact match against the owner's saved merchant rules.
 *
 * The merchant is normalized to a stable token (see normalizeMerchant) and
 * compared against `merchant_rules.merchant_pattern`, which is stored already
 * normalized. A hit resolves the linked project and returns a near-certain
 * result; the LLM is never consulted.
 *
 * Returns null when there's no merchant, no matching rule, or the linked
 * project has gone missing — the caller then falls through to the LLM.
 */
export async function matchRule(
  ownerId: string,
  merchant: string | null,
): Promise<ClassifyResult | null> {
  const normalized = normalizeMerchant(merchant)
  if (!normalized) return null

  const { data: rule, error } = await db()
    .from('merchant_rules')
    .select('project_id')
    .eq('owner_id', ownerId)
    .eq('merchant_pattern', normalized)
    .maybeSingle()
  if (error || !rule) return null

  const { data: project, error: projErr } = await db()
    .from('projects')
    .select('id, slug, name')
    .eq('owner_id', ownerId)
    .eq('id', rule.project_id)
    .maybeSingle()
  if (projErr || !project) return null

  return {
    projectId: project.id,
    projectSlug: project.slug,
    projectName: project.name,
    confidence: 0.99,
    reasoning: 'matched your saved rule',
    source: 'rule',
    suggestNewProject: false,
  }
}
