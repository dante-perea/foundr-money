import 'server-only'
import { db } from './db'

export interface AllocationInput {
  projectId: string
  amountCents: number
  categoryId?: string | null
  note?: string | null
}

/** Replace a transaction's allocations (re-tag or split) atomically.
 *  Allocations must sum to the transaction total (enforced by trigger). */
export async function retagTransaction(
  ownerId: string,
  txnId: string,
  allocations: AllocationInput[],
): Promise<void> {
  const { error } = await db().rpc('fm_retag_transaction', {
    p_owner: ownerId,
    p_txn: txnId,
    p_allocs: allocations.map((a) => ({
      project_id: a.projectId,
      amount_cents: a.amountCents,
      category_id: a.categoryId ?? null,
      note: a.note ?? null,
    })),
  })
  if (error) throw error
}

/** Record a tagging decision for the learning loop; promote confident
 *  single-project tags to a deterministic merchant rule. */
export async function recordTaggingFeedback(
  ownerId: string,
  input: {
    transactionId: string
    suggestedProjectId?: string | null
    confirmedProjectId: string
    wasOverride: boolean
    confidence?: number | null
    merchantNormalized?: string | null
    categoryId?: string | null
  },
): Promise<void> {
  await db().from('tagging_feedback').insert({
    owner_id: ownerId,
    transaction_id: input.transactionId,
    suggested_project_id: input.suggestedProjectId ?? null,
    confirmed_project_id: input.confirmedProjectId,
    was_override: input.wasOverride,
    confidence: input.confidence ?? null,
  })
  // Promote to a deterministic rule so this merchant never hits the LLM again.
  if (input.merchantNormalized) {
    await db()
      .from('merchant_rules')
      .upsert(
        {
          owner_id: ownerId,
          merchant_pattern: input.merchantNormalized,
          project_id: input.confirmedProjectId,
          category_id: input.categoryId ?? null,
          source: 'promoted',
        },
        { onConflict: 'owner_id,merchant_pattern' },
      )
  }
}
