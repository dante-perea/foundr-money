import type { TransactionWithAllocations } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'

function fmtDate(iso: string): string {
  // posted_at is a date/timestamp string; render short + stable.
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** One transaction line for a project detail list.
 *  House convention: expense = positive cents, income = negative cents. */
export function TransactionRow({ txn }: { txn: TransactionWithAllocations }) {
  const isIncome = txn.amount_cents < 0
  const merchant = txn.merchant_name ?? txn.description ?? 'Transaction'
  return (
    <li className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink">{merchant}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
          <span className="tabular">{fmtDate(txn.posted_at)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{txn.account_name}</span>
          {txn.pending ? (
            <span className="rounded bg-bg-alt px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
              pending
            </span>
          ) : null}
        </span>
      </div>
      <span className={isIncome ? 'tabular shrink-0 text-sm font-medium text-success' : 'tabular shrink-0 text-sm font-medium text-ink'}>
        {isIncome ? '+' : '−'}
        {formatCents(txn.amount_cents)}
      </span>
    </li>
  )
}
