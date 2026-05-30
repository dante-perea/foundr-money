'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import type { Category, Project, TransactionWithAllocations } from '@/lib/money/types'
import { formatCents, centsToDollars, dollarsToCents } from '@/lib/money/money'
import { cn } from '@/lib/cn'
import { ProjectDot } from './ProjectDot'
import type { SuggestResult, TagAllocationInput } from '@/app/dashboard/transactions/actions'

interface SplitRow {
  key: string
  projectId: string
  amountCents: number
}

let _rowSeq = 0
const nextKey = () => `row-${_rowSeq++}`

/**
 * Inline tagging surface. Two modes:
 *  - one: pick a single project (one click confirms with the full amount)
 *  - split: divide the total across N projects; confirm disabled until the
 *    running remainder is zero.
 * A "✨ Suggest" button asks the classifier and offers a one-click Apply.
 */
export function TagPopover({
  txn,
  projects,
  categories,
  onConfirm,
  onSuggest,
  onClose,
}: {
  txn: TransactionWithAllocations
  projects: Project[]
  categories: Category[]
  onConfirm: (allocations: TagAllocationInput[]) => void
  onSuggest: () => Promise<SuggestResult>
  onClose: () => void
}) {
  const total = txn.amount_cents
  const currency = txn.currency
  const labelId = useId()

  // Real (non-personal) projects first in the picker; personal last.
  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => Number(a.is_personal) - Number(b.is_personal)),
    [projects],
  )

  const [mode, setMode] = useState<'one' | 'split'>('one')
  const [categoryId, setCategoryId] = useState<string | null>(
    (txn.allocations[0]?.category_id as string | null | undefined) ?? null,
  )

  // Seed split rows from current allocations (or two empty rows).
  const [rows, setRows] = useState<SplitRow[]>(() =>
    txn.allocations.length > 1
      ? txn.allocations.map((a) => ({ key: nextKey(), projectId: a.project_id, amountCents: a.amount_cents }))
      : [
          { key: nextKey(), projectId: '', amountCents: total },
          { key: nextKey(), projectId: '', amountCents: 0 },
        ],
  )

  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null)
  const [suggestPending, startSuggest] = useTransition()

  const containerRef = useRef<HTMLDivElement>(null)

  // Dismiss on outside click + Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  function commitSingle(projectId: string) {
    onConfirm([{ projectId, amountCents: total, categoryId }])
  }

  // --- split math ---
  const allocated = rows.reduce((sum, r) => sum + (r.projectId ? r.amountCents : 0), 0)
  const remainder = total - allocated
  const balanced = remainder === 0 && rows.every((r) => !r.projectId || r.amountCents !== 0)
  const splitValid =
    balanced &&
    rows.filter((r) => r.projectId).length >= 1 &&
    new Set(rows.filter((r) => r.projectId).map((r) => r.projectId)).size ===
      rows.filter((r) => r.projectId).length

  function updateRow(key: string, patch: Partial<SplitRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, { key: nextKey(), projectId: '', amountCents: Math.max(remainder, 0) }])
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((r) => r.key !== key)))
  }

  function commitSplit() {
    if (!splitValid) return
    const allocations: TagAllocationInput[] = rows
      .filter((r) => r.projectId && r.amountCents !== 0)
      .map((r) => ({ projectId: r.projectId, amountCents: r.amountCents, categoryId }))
    onConfirm(allocations)
  }

  function runSuggest() {
    startSuggest(async () => {
      const s = await onSuggest()
      setSuggestion(s)
    })
  }

  function applySuggestion() {
    if (suggestion?.projectId) commitSingle(suggestion.projectId)
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-labelledby={labelId}
      className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-line bg-surface p-4 shadow-lg shadow-ink/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <span id={labelId} className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
          Tag transaction
        </span>
        <div className="inline-flex rounded-md border border-line p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('one')}
            className={cn(
              'rounded px-2 py-1 font-medium transition',
              mode === 'one' ? 'bg-accent text-white' : 'text-muted hover:text-ink',
            )}
          >
            One
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            className={cn(
              'rounded px-2 py-1 font-medium transition',
              mode === 'split' ? 'bg-accent text-white' : 'text-muted hover:text-ink',
            )}
          >
            Split
          </button>
        </div>
      </div>

      {/* Suggest */}
      <button
        type="button"
        onClick={runSuggest}
        className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-line-strong disabled:opacity-60"
        disabled={suggestPending}
      >
        <span aria-hidden>✨</span>
        {suggestPending ? 'Thinking…' : 'Suggest a project'}
      </button>

      {suggestion && (
        <div className="mb-3 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
          {suggestion.projectId && suggestion.source !== 'none' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <ProjectDot
                    color={
                      orderedProjects.find((p) => p.id === suggestion.projectId)?.color ?? '#3b82f6'
                    }
                  />
                  {suggestion.projectName ?? 'Suggested project'}
                </span>
                <span className="tabular font-mono text-subtle">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </div>
              {suggestion.reasoning && (
                <p className="mt-1.5 leading-snug text-muted">{suggestion.reasoning}</p>
              )}
              <button
                type="button"
                onClick={applySuggestion}
                className="mt-2.5 w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
              >
                Apply
              </button>
            </>
          ) : (
            <p className="leading-snug text-muted">
              {suggestion.reasoning || 'No confident match — pick a project below.'}
            </p>
          )}
        </div>
      )}

      {/* One-project mode */}
      {mode === 'one' && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {orderedProjects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => commitSingle(p.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-bg-alt focus:bg-bg-alt focus:outline-none"
              >
                <ProjectDot color={p.color} />
                <span className="truncate">{p.name}</span>
                {p.is_personal && (
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-subtle">
                    untag
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Split mode */}
      {mode === 'split' && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <select
                value={r.projectId}
                onChange={(e) => updateRow(r.key, { projectId: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Choose…</option>
                {orderedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-subtle">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={Number.isFinite(r.amountCents) ? centsToDollars(r.amountCents) : ''}
                  onChange={(e) =>
                    updateRow(r.key, {
                      amountCents: e.target.value === '' ? 0 : dollarsToCents(Number(e.target.value)),
                    })
                  }
                  className="tabular w-full rounded-md border border-line bg-surface py-1.5 pl-5 pr-1.5 text-right text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                aria-label="Remove split row"
                disabled={rows.length <= 2}
                className="shrink-0 rounded p-1 text-subtle transition hover:text-ink disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="text-xs font-medium text-accent transition hover:text-accent-hover"
          >
            + Add project
          </button>

          <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
            <span className="text-muted">Remainder</span>
            <span
              className={cn('tabular font-mono', remainder === 0 ? 'text-success' : 'text-warning')}
            >
              {formatCents(remainder, currency, { signed: true })}
            </span>
          </div>

          <button
            type="button"
            onClick={commitSplit}
            disabled={!splitValid}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm split
          </button>
        </div>
      )}

      {/* Schedule C category — optional */}
      {categories.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
            Schedule C category (optional)
          </label>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.schedule_c_line ? ` · ${c.schedule_c_line}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
