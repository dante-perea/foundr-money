'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { formatCents, dollarsToCents } from '@/lib/money/money'
import { addExpense, type AddedExpense } from '@/app/onboarding/actions'
import type { WizardProject } from '@/app/onboarding/onboarding-client'

const MERCHANTS = [
  'OpenAI',
  'Anthropic',
  'Vercel',
  'Supabase',
  'Cursor',
  'Linear',
  'GitHub',
  'Fly.io',
]

function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * (ii) The instant aha — one real expense lands on a project. Defaults the
 * project select to the first project so a one-field-typed expense is valid
 * instantly. On add, the form collapses into a confirmation chip.
 */
export function QuickExpenseCard({
  projects,
  count,
  onAdded,
}: {
  projects: WizardProject[]
  /** Number of expenses already added (drives the header chip). */
  count: number
  onAdded: (e: AddedExpense) => void
}) {
  const first = projects[0]
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [projectId, setProjectId] = useState(first?.id ?? '')
  const [pending, startAdd] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<AddedExpense | null>(null)

  const dollars = parseDollars(amount)
  const canAdd = merchant.trim().length > 0 && dollars !== null && !pending

  function submit() {
    setError(null)
    const cents = dollars === null ? null : dollarsToCents(dollars)
    if (!merchant.trim()) return
    if (cents === null) {
      setError('enter an amount.')
      return
    }
    startAdd(async () => {
      try {
        const row = await addExpense({ merchant: merchant.trim(), amountCents: cents, projectId })
        setConfirmed(row)
        onAdded(row)
      } catch {
        setError('couldn’t save — retry.')
      }
    })
  }

  function reset() {
    setConfirmed(null)
    setMerchant('')
    setAmount('')
    // keep the same project defaulted
  }

  const confirmedProject = confirmed
    ? projects.find((p) => p.id === confirmed.projectId)
    : undefined

  return (
    <article className="rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">＄ One transaction</p>
        {count > 0 && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
            ✓ {count} {count === 1 ? 'expense' : 'expenses'}
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-lg font-medium text-ink">Add an expense</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        drop in one charge and watch it land on a project — that’s the whole product in one row.
      </p>

      {confirmed ? (
        <div className="mt-5 rounded-md border border-success/30 bg-success/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span className="tabular font-medium">{formatCents(confirmed.amountCents)}</span>
              <span className="text-muted">· {confirmed.merchant} →</span>
              {confirmedProject && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: confirmedProject.color }}
                  />
                  {confirmedProject.name}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={reset}
              className="rounded text-sm text-accent transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              add another
            </button>
          </div>
          <p className="mt-2 text-xs text-success">it’s on your dashboard now.</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
                merchant
              </span>
              <input
                type="text"
                list="fm-merchants"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="OpenAI"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 sm:text-sm"
              />
              <datalist id="fm-merchants">
                {MERCHANTS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
                amount
              </span>
              <div className="flex items-center rounded-md border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                <span aria-hidden className="text-subtle">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="20.00"
                  aria-label="Amount in dollars"
                  className="tabular w-full bg-surface py-2.5 pl-1.5 text-base text-ink placeholder:text-subtle focus:outline-none sm:text-sm"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
                project
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                aria-label="Project"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 sm:text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!canAdd}
              className={cn(
                'rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                pending && 'cursor-wait opacity-70',
                !canAdd && !pending && 'cursor-not-allowed opacity-50 hover:bg-accent',
              )}
            >
              {pending ? 'Adding…' : 'Add expense'}
            </button>
            {error && <span className="text-xs text-warning">{error}</span>}
          </div>

          {projects.length === 1 && projects[0]?.name === 'Personal' && (
            <p className="mt-2 text-xs text-subtle">tag it to a project later from the dashboard.</p>
          )}
        </div>
      )}
    </article>
  )
}
