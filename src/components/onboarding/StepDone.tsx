'use client'

import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/money/money'
import type { WizardProject } from '@/app/onboarding/onboarding-client'

interface ExpenseSummary {
  amountCents: number
  merchant: string
  projectColor?: string
  projectName?: string
}

/**
 * Step 3 — restrained celebration + a concrete recap of the real signal + one
 * obvious door to the dashboard. The recap lists ONLY rows that actually
 * happened (never advertises what was skipped). No confetti, no glow.
 */
export function StepDone({
  projects,
  personalOnly,
  keyTail,
  expense,
  exampleProject,
  finishing,
  onFinish,
  onAddMore,
}: {
  projects: WizardProject[]
  /** True when the only project is the implicit Personal one. */
  personalOnly: boolean
  /** Last 4 of the minted key, or null. */
  keyTail: string | null
  expense: ExpenseSummary | null
  exampleProject: string
  finishing: boolean
  onFinish: () => void
  onAddMore: () => void
}) {
  const swatches = projects.slice(0, 3)
  const overflow = projects.length - swatches.length

  const showActivity = Boolean(keyTail) || Boolean(expense) || !personalOnly
  const headline = showActivity
    ? 'foundr.money is tracking your burn.'
    : 'your workspace is ready.'

  return (
    <div className="flex flex-1 flex-col items-center pt-16 text-center">
      {/* Success mark */}
      <span
        aria-hidden
        className="fm-success-mark flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent text-2xl text-accent"
      >
        ✓
      </span>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-subtle">You’re set</p>
      <h1
        tabIndex={-1}
        className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink focus:outline-none sm:text-4xl"
      >
        {headline}
      </h1>

      {/* Recap card */}
      <div className="mt-8 w-full rounded-md border border-line bg-surface p-6 text-left">
        <RecapRow label="Projects" icon="●">
          {personalOnly ? (
            <span className="text-muted">tracking personal spend</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-ink">
                {projects.length} created
              </span>
              <span className="flex items-center gap-1">
                {swatches.map((p) => (
                  <span
                    key={p.id}
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                ))}
                {overflow > 0 && <span className="text-subtle">+{overflow}</span>}
              </span>
            </span>
          )}
        </RecapRow>

        {keyTail && (
          <RecapRow label="Editor key" icon="⌘">
            <span className="flex items-center gap-1.5 text-success">
              <span aria-hidden>✓</span>
              <span className="font-mono text-sm">generated · fm_…{keyTail}</span>
            </span>
          </RecapRow>
        )}

        {expense && (
          <RecapRow label="Expense" icon="＄">
            <span className="flex items-center gap-1.5">
              <span className="tabular font-mono text-sm text-ink">
                1 logged · {formatCents(expense.amountCents)}
              </span>
              <span className="text-muted">→</span>
              {expense.projectName && (
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: expense.projectColor }}
                  />
                  {expense.projectName}
                </span>
              )}
            </span>
          </RecapRow>
        )}
      </div>

      {/* What-now nudge — only if a key was minted */}
      {keyTail && (
        <p className="mt-6 text-sm text-muted">
          next: open Claude Code and say{' '}
          <span className="text-ink">“tag my last openai charge to {exampleProject}.”</span>
        </p>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onFinish}
        disabled={finishing}
        className={cn(
          'mt-8 w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover sm:w-auto',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          finishing && 'cursor-wait opacity-70',
        )}
      >
        {finishing ? 'Opening dashboard…' : 'Go to your dashboard →'}
      </button>

      {/* Quiet secondary */}
      <button
        type="button"
        onClick={onAddMore}
        className="mt-4 rounded text-sm text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        add more projects
      </button>
    </div>
  )
}

function RecapRow({
  label,
  icon,
  children,
}: {
  label: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        <span aria-hidden className="text-sm text-subtle">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}
