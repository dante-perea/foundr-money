'use server'

import { requireOwnerId } from '@/lib/money/owner'
import { getTransaction } from '@/lib/money/transactions'
import { retagTransaction, recordTaggingFeedback, type AllocationInput } from '@/lib/money/allocations'
import { normalizeMerchant } from '@/lib/money/money'
import { classifyTransaction } from '@/lib/money/classifier'
import type { TransactionWithAllocations } from '@/lib/money/types'

export interface TagAllocationInput {
  projectId: string
  amountCents: number
  categoryId?: string | null
  note?: string | null
}

export interface SuggestResult {
  projectId: string | null
  projectSlug: string | null
  projectName: string | null
  confidence: number
  reasoning: string
  source: 'rule' | 'llm' | 'none'
  suggestNewProject: boolean
}

/**
 * Re-tag (or split) a transaction. Replaces its allocations atomically — the
 * amounts must already sum to the transaction total (the client enforces this
 * and the RPC trigger rejects otherwise). Records tagging feedback; a single
 * full-amount allocation promotes a merchant rule via merchantNormalized.
 *
 * Returns the authoritative refreshed row so the client can commit it into the
 * useOptimistic base. No revalidateTag/updateTag — per the repo optimistic
 * pattern, the action returns the row and the client owns freshness.
 */
export async function retagTxnAction(
  txnId: string,
  allocations: TagAllocationInput[],
): Promise<TransactionWithAllocations | null> {
  const owner = await requireOwnerId()

  // Read the pre-retag state so we can tell whether this tag overrides a prior
  // non-Personal decision (for the learning loop's wasOverride signal).
  const before = await getTransaction(owner, txnId)

  const allocInputs: AllocationInput[] = allocations.map((a) => ({
    projectId: a.projectId,
    amountCents: a.amountCents,
    categoryId: a.categoryId ?? null,
    note: a.note ?? null,
  }))

  await retagTransaction(owner, txnId, allocInputs)

  // Single full-amount allocation → promote a deterministic merchant rule so
  // this merchant skips the LLM next time.
  if (allocations.length === 1) {
    const confirmed = allocations[0]
    const wasUntaggedBefore =
      !before ||
      (before.allocations.length === 1 &&
        (before.allocations[0] as { project_is_personal?: boolean }).project_is_personal === true)
    const merchantNormalized = before?.merchant_name
      ? normalizeMerchant(before.merchant_name)
      : null
    await recordTaggingFeedback(owner, {
      transactionId: txnId,
      confirmedProjectId: confirmed.projectId,
      wasOverride: !wasUntaggedBefore,
      merchantNormalized,
      categoryId: confirmed.categoryId ?? null,
    })
  }

  return getTransaction(owner, txnId)
}

/** Ask the classifier where this transaction should be tagged. */
export async function suggestTagAction(txnId: string): Promise<SuggestResult> {
  const owner = await requireOwnerId()
  const txn = await getTransaction(owner, txnId)
  if (!txn) {
    return {
      projectId: null,
      projectSlug: null,
      projectName: null,
      confidence: 0,
      reasoning: 'Transaction not found.',
      source: 'none',
      suggestNewProject: false,
    }
  }
  const s = await classifyTransaction(owner, {
    merchant: txn.merchant_name,
    description: txn.description,
    amountCents: txn.amount_cents,
  })
  return s
}
