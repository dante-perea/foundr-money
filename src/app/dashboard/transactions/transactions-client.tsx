'use client'

import { useCallback, useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Category, Project, TransactionWithAllocations } from '@/lib/money/types'
import { cn } from '@/lib/cn'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { isUntagged } from '@/components/transactions/AllocationChips'
import { retagTxnAction, suggestTagAction, type SuggestResult, type TagAllocationInput } from './actions'

type Filter = 'all' | 'untagged'

interface OptimisticTag {
  txnId: string
  allocations: TagAllocationInput[]
}

/**
 * Build an optimistic allocation list from a tag input, resolving project
 * metadata (name/color/slug/is_personal) from the projects list so the row
 * re-renders instantly with the right chips.
 */
function projectMeta(projects: Project[], projectId: string) {
  const p = projects.find((x) => x.id === projectId)
  return {
    project_name: p?.name ?? 'Project',
    project_slug: p?.slug ?? 'project',
    project_color: p?.color ?? '#3b82f6',
    project_is_personal: p?.is_personal ?? false,
  }
}

export function TransactionsClient({
  txns,
  projects,
  categories,
  initialFilter,
}: {
  txns: TransactionWithAllocations[]
  projects: Project[]
  categories: Category[]
  initialFilter: Filter
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [openId, setOpenId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Authoritative rows committed back from the server action, keyed by id.
  // updated_at (we proxy with created_at + a local clock) decides precedence.
  const [confirmed, setConfirmed] = useState<Record<string, TransactionWithAllocations>>({})

  // Base list = server props overlaid with any confirmed authoritative rows.
  const base = useMemo<TransactionWithAllocations[]>(
    () => txns.map((t) => confirmed[t.id] ?? t),
    [txns, confirmed],
  )

  // Optimistic layer — applied on top of base while a tag action is in flight.
  const [optimistic, applyOptimistic] = useOptimistic(
    base,
    (state: TransactionWithAllocations[], tag: OptimisticTag) =>
      state.map((t) => {
        if (t.id !== tag.txnId) return t
        const allocations = tag.allocations.map((a, i) => ({
          id: `optimistic-${t.id}-${i}`,
          owner_id: t.owner_id,
          transaction_id: t.id,
          project_id: a.projectId,
          category_id: a.categoryId ?? null,
          amount_cents: a.amountCents,
          pct: null,
          note: a.note ?? null,
          created_at: t.created_at,
          ...projectMeta(projects, a.projectId),
        }))
        return { ...t, allocations } as TransactionWithAllocations
      }),
  )

  const handleConfirm = useCallback(
    (txnId: string, allocations: TagAllocationInput[]) => {
      setOpenId(null)
      startTransition(async () => {
        applyOptimistic({ txnId, allocations })
        const row = await retagTxnAction(txnId, allocations)
        if (row) setConfirmed((prev) => ({ ...prev, [row.id]: row }))
      })
    },
    [applyOptimistic],
  )

  const handleSuggest = useCallback(
    (txnId: string): Promise<SuggestResult> => suggestTagAction(txnId),
    [],
  )

  const untaggedCount = useMemo(() => optimistic.filter(isUntagged).length, [optimistic])

  const visible = useMemo(
    () => (filter === 'untagged' ? optimistic.filter(isUntagged) : optimistic),
    [optimistic, filter],
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Transactions</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          tag in the loop you make decisions
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every charge lands here untagged. Assign it to a project in one click, or split it across
          a few. You can also tag straight from Claude Code or Cursor —{' '}
          <Link href="/dashboard/connect" className="font-medium text-accent hover:text-accent-hover">
            connect the MCP
          </Link>{' '}
          and your agent does it while you build.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-line">
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
          All
          <span className="ml-1.5 tabular font-mono text-xs text-subtle">{optimistic.length}</span>
        </FilterTab>
        <FilterTab active={filter === 'untagged'} onClick={() => setFilter('untagged')}>
          Untagged
          <span
            className={cn(
              'ml-1.5 tabular font-mono text-xs',
              untaggedCount > 0 ? 'text-warning' : 'text-subtle',
            )}
          >
            {untaggedCount}
          </span>
        </FilterTab>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {/* column header — desktop only */}
        <div className="hidden grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1.6fr)_8rem_auto] gap-x-4 border-b border-line bg-bg-alt px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle sm:grid">
          <span>Date</span>
          <span>Merchant</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Project</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState filter={filter} onSeeAll={() => setFilter('all')} />
        ) : (
          visible.map((t) => (
            <TransactionRow
              key={t.id}
              txn={t}
              projects={projects}
              categories={categories}
              open={openId === t.id}
              onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
              onConfirm={(allocations) => handleConfirm(t.id, allocations)}
              onSuggest={() => handleSuggest(t.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-accent text-ink'
          : 'border-transparent text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function EmptyState({ filter, onSeeAll }: { filter: Filter; onSeeAll: () => void }) {
  if (filter === 'untagged') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <span className="text-success" aria-hidden>
          ✓
        </span>
        <p className="text-sm font-medium text-ink">Inbox zero.</p>
        <p className="max-w-sm text-sm text-muted">
          Every transaction is tagged to a project. New charges show up here the moment they post.
        </p>
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-line-strong"
        >
          See all transactions
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">No transactions yet.</p>
      <p className="max-w-sm text-sm text-muted">
        Connect an account and your spend starts flowing in — untagged, ready for you to sort.
      </p>
      <Link
        href="/dashboard/connect"
        className="mt-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
      >
        Connect an account
      </Link>
    </div>
  )
}
