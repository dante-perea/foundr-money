'use client'

import type { TransactionWithAllocations } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { ProjectDot } from './ProjectDot'

type Alloc = TransactionWithAllocations['allocations'][number] & {
  project_is_personal?: boolean
}

/** Is this transaction effectively untagged? (every allocation is Personal) */
export function isUntagged(txn: TransactionWithAllocations): boolean {
  const allocs = txn.allocations as Alloc[]
  return allocs.length > 0 && allocs.every((a) => a.project_is_personal)
}

/**
 * Read-only render of a transaction's current allocations. An untagged txn
 * (only-Personal) shows a single inviting "Untagged" pill; a split shows each
 * project with its slice amount.
 */
export function AllocationChips({
  txn,
  currency,
}: {
  txn: TransactionWithAllocations
  currency: string
}) {
  const allocs = txn.allocations as Alloc[]

  if (isUntagged(txn) || allocs.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/5 px-2.5 py-0.5 text-xs font-medium text-warning">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
        Untagged
      </span>
    )
  }

  const isSplit = allocs.length > 1

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {allocs.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-alt px-2.5 py-0.5 text-xs font-medium text-ink"
        >
          <ProjectDot color={a.project_color} />
          <span className="max-w-[10rem] truncate">{a.project_name}</span>
          {isSplit && (
            <span className="tabular text-subtle">{formatCents(a.amount_cents, currency)}</span>
          )}
        </span>
      ))}
    </span>
  )
}
