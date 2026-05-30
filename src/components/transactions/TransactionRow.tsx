'use client'

import type { Category, Project, TransactionWithAllocations } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { cn } from '@/lib/cn'
import { AllocationChips, isUntagged } from './AllocationChips'
import { TagPopover } from './TagPopover'
import type { SuggestResult, TagAllocationInput } from '@/app/dashboard/transactions/actions'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PROVIDER_LABEL: Record<string, string> = {
  plaid: 'bank',
  stripe: 'stripe',
  manual: 'manual',
  openai: 'openai',
  anthropic: 'anthropic',
  vercel: 'vercel',
  supabase: 'supabase',
  cursor: 'cursor',
}

export function TransactionRow({
  txn,
  projects,
  categories,
  open,
  onToggle,
  onConfirm,
  onSuggest,
}: {
  txn: TransactionWithAllocations
  projects: Project[]
  categories: Category[]
  open: boolean
  onToggle: () => void
  onConfirm: (allocations: TagAllocationInput[]) => void
  onSuggest: () => Promise<SuggestResult>
}) {
  const income = txn.direction === 'income'
  const untagged = isUntagged(txn)

  return (
    <div
      className={cn(
        'group grid grid-cols-[5rem_1fr_auto] items-start gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 transition sm:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1.6fr)_8rem_auto]',
        untagged ? 'bg-warning/[0.02] hover:bg-warning/[0.04]' : 'hover:bg-bg-alt',
      )}
    >
      {/* date */}
      <div className="tabular pt-0.5 font-mono text-xs text-subtle">{fmtDate(txn.posted_at)}</div>

      {/* merchant + account chip */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {txn.merchant_name || 'Unknown merchant'}
          </span>
          {txn.pending && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-subtle">
              pending
            </span>
          )}
        </div>
        <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
          {PROVIDER_LABEL[txn.account_provider] ?? txn.account_provider} · {txn.account_name}
        </span>
      </div>

      {/* description — hidden on small screens */}
      <div className="hidden min-w-0 pt-0.5 sm:block">
        <span className="block truncate text-sm text-muted">{txn.description || '—'}</span>
      </div>

      {/* amount */}
      <div
        className={cn(
          'tabular pt-0.5 text-right text-sm font-medium',
          income ? 'text-success' : 'text-ink',
        )}
      >
        {formatCents(txn.amount_cents, txn.currency, { signed: true })}
      </div>

      {/* tag control + popover */}
      <div className="relative col-span-2 flex justify-start sm:col-span-1 sm:justify-end">
        <button
          type="button"
          onClick={onToggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            untagged && 'ring-1 ring-warning/20',
          )}
        >
          <AllocationChips txn={txn} currency={txn.currency} />
        </button>
        {open && (
          <TagPopover
            txn={txn}
            projects={projects}
            categories={categories}
            onConfirm={onConfirm}
            onSuggest={onSuggest}
            onClose={onToggle}
          />
        )}
      </div>
    </div>
  )
}
