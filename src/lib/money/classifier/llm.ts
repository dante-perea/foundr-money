import 'server-only'
import { generateObject, NoObjectGeneratedError } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import { listProjects } from '../projects'
import { formatCents } from '../money'
import { CLASSIFIER_MODEL, CONFIDENCE_THRESHOLD } from '../constants'
import type { ClassifyInput, ClassifyResult } from './index'

/** Sentinel slug the model returns when no project is a confident fit. */
const NEEDS_REVIEW = '__needs_review__'

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
 * Leg 2 of the cascade: ask Haiku-4.5 (via the AI Gateway) to pick the best
 * project for a charge, or to flag it for review.
 *
 * Hard-fails *gracefully* to a `source:'none'` result when:
 *  - AI_GATEWAY_API_KEY is unset (no model wired up), or
 *  - the owner has no non-personal projects to choose from, or
 *  - the model errors / returns an unparseable object.
 *
 * Never throws — the surrounding demo flow must survive a model outage.
 */
export async function classifyWithLlm(
  ownerId: string,
  input: ClassifyInput,
): Promise<ClassifyResult> {
  if (!process.env.AI_GATEWAY_API_KEY) return NONE

  // Only real (non-personal) projects are classification targets. The
  // personal/unallocated bucket is where untagged spend already lives.
  const projects = (await listProjects(ownerId)).filter((p) => !p.is_personal)
  if (projects.length === 0) return NONE

  const slugs = projects.map((p) => p.slug)
  // zod enum needs a non-empty tuple. The length check above guarantees at
  // least one slug, so slugs[0] is present; the review sentinel is always last.
  const slugEnum = z.enum([slugs[0], ...slugs.slice(1), NEEDS_REVIEW])

  const schema = z.object({
    projectSlug: slugEnum,
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    suggestNewProject: z.boolean(),
  })

  const roster = projects
    .map((p) => `- ${p.slug} — ${p.name}${p.description ? ` — ${p.description}` : ''}`)
    .join('\n')

  const system = [
    'You categorize a founder\'s business expenses into one of their projects.',
    'The founder runs several projects on a single card; each charge belongs to the project it was spent on.',
    '',
    'Their projects (slug — name — description):',
    roster,
    '',
    'Rules:',
    `- Pick the single best project slug for the charge, or return "${NEEDS_REVIEW}" if you are not reasonably sure.`,
    '- confidence is your 0..1 certainty in the chosen slug.',
    `- Set suggestNewProject true only if the charge clearly belongs to a real business venture that is NOT in the list above (so the founder might want to create a new project for it).`,
    '- reasoning is one short sentence the founder will read.',
  ].join('\n')

  const prompt = [
    `Merchant: ${input.merchant ?? '(unknown)'}`,
    input.description ? `Description: ${input.description}` : null,
    `Amount: ${formatCents(input.amountCents)} (expense)`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const { object } = await generateObject({
      model: gateway(CLASSIFIER_MODEL),
      schema,
      system,
      prompt,
    })

    const lowConfidence =
      object.projectSlug === NEEDS_REVIEW || object.confidence < CONFIDENCE_THRESHOLD

    if (lowConfidence) {
      // Route to in-loop tagging, but still surface the model's best guess
      // (slug may be the review sentinel → null) so the UI can show it.
      const guessed =
        object.projectSlug === NEEDS_REVIEW
          ? null
          : projects.find((p) => p.slug === object.projectSlug) ?? null
      return {
        projectId: null,
        projectSlug: guessed ? guessed.slug : null,
        projectName: guessed ? guessed.name : null,
        confidence: object.confidence,
        reasoning: object.reasoning,
        source: 'llm',
        suggestNewProject: object.suggestNewProject,
      }
    }

    const project = projects.find((p) => p.slug === object.projectSlug)
    if (!project) return NONE // defensive: enum guarantees this, but never trust the wire

    return {
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      confidence: object.confidence,
      reasoning: object.reasoning,
      source: 'llm',
      suggestNewProject: object.suggestNewProject,
    }
  } catch (err) {
    // NoObjectGeneratedError (schema/parse miss) or any transport error — degrade
    // silently to "none" so the demo never breaks on a model hiccup.
    if (NoObjectGeneratedError.isInstance(err)) return NONE
    return NONE
  }
}
