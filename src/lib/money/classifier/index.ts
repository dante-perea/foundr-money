import 'server-only'
import { matchRule } from './rules'
import { classifyWithLlm } from './llm'

/** Input to the classifier — the minimal shape of a charge to tag. */
export interface ClassifyInput {
  merchant: string | null
  description: string | null
  amountCents: number
}

/** Unified classifier result. `source` records which leg of the cascade decided. */
export interface ClassifyResult {
  /** Resolved project id, or null when low-confidence / needs review / no model. */
  projectId: string | null
  /** Suggested project slug — present even when projectId is null so the UI can show it. */
  projectSlug: string | null
  /** Suggested project name — present even when projectId is null. */
  projectName: string | null
  /** 0..1. 0.99 for a saved-rule hit, the model's own confidence for LLM, 0 for none. */
  confidence: number
  /** Human-readable rationale to surface in the in-loop tagging UI. */
  reasoning: string
  /** Which leg of the cascade produced this result. */
  source: 'rule' | 'llm' | 'none'
  /** Model hint that this charge looks like a new project the founder hasn't created. */
  suggestNewProject: boolean
}

const NONE: ClassifyResult = {
  projectId: null,
  projectSlug: null,
  projectName: null,
  confidence: 0,
  reasoning: 'no rule or model available',
  source: 'none',
  suggestNewProject: false,
}

/**
 * Classify a single transaction into one of the owner's projects.
 *
 * Cascade:
 *  1. RULES — an exact match on a saved merchant rule wins instantly (confidence 0.99).
 *  2. LLM   — Haiku-4.5 via the AI Gateway picks the best project, or routes to review.
 *  3. NONE  — no rule, no model/projects, or any model error → safe empty result.
 *
 * Never throws: the demo must survive a model outage.
 */
export async function classifyTransaction(
  ownerId: string,
  input: ClassifyInput,
): Promise<ClassifyResult> {
  // 1) Rules-first — deterministic, free, instant.
  const rule = await matchRule(ownerId, input.merchant)
  if (rule) return rule

  // 2) LLM fallback — self-contained try/catch lives inside classifyWithLlm.
  return classifyWithLlm(ownerId, input)
}

/**
 * Classify many transactions. Runs in small concurrent batches (≤10) to keep
 * gateway load and rate-limit pressure bounded while staying fast for a demo set.
 * Order of results matches the input order.
 */
export async function classifyBatch(
  ownerId: string,
  items: ClassifyInput[],
): Promise<ClassifyResult[]> {
  const BATCH = 10
  const out: ClassifyResult[] = []
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH)
    const settled = await Promise.all(
      slice.map((item) =>
        classifyTransaction(ownerId, item).catch(() => NONE),
      ),
    )
    out.push(...settled)
  }
  return out
}
