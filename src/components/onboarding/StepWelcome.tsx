'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

const PROOF = ['PROJECT-FIRST', 'TAG FROM YOUR EDITOR', 'NO ENTITY']

/**
 * Step 0 — value in one breath, then the two intents split with zero ambiguity:
 * commit (set it up) vs. evaluate (sample data). No rail, no footer nav — the
 * CTAs live in-hero. The demo fork is hidden when the workspace already has real
 * data (never offer to pollute a real account).
 */
export function StepWelcome({
  resuming,
  resumeCount,
  showDemo,
  onSetup,
  onSample,
}: {
  resuming: boolean
  resumeCount: number
  showDemo: boolean
  onSetup: () => void
  onSample: () => Promise<void> | void
}) {
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [demoError, setDemoError] = useState(false)

  async function startDemo() {
    if (loadingDemo) return
    setDemoError(false)
    setLoadingDemo(true)
    try {
      await onSample()
      // Navigation happens server-side (redirect) — keep the loading state.
    } catch {
      setDemoError(true)
      setLoadingDemo(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center pb-10 pt-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">First run</p>

      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        five projects. one card.
        <br />
        <span className="text-muted">now you can tell them apart.</span>
      </h1>

      <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-muted">
        foundr.money is project-first burn tracking for the founder running a handful of things on
        one personal card. no entity required. tag spend right where you work — inside Claude Code
        or Cursor.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        {PROOF.map((p, i) => (
          <span key={p} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {p}
          </span>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {/* Card A — primary (commit) */}
        <button
          type="button"
          onClick={onSetup}
          className={cn(
            'group flex cursor-pointer flex-col rounded-md border border-accent/40 bg-accent/[0.04] p-6 text-left transition hover:border-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Set it up</p>
          <h2 className="mt-2 font-display text-lg font-medium text-ink">Set up my projects</h2>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
            {resuming
              ? `pick up where you left off — ${resumeCount} ${resumeCount === 1 ? 'project' : 'projects'} so far.`
              : 'add your projects, grab your MCP key, log one real expense. about 60 seconds.'}
          </p>
          <span aria-hidden className="mt-4 self-end text-accent transition group-hover:translate-x-0.5">
            →
          </span>
        </button>

        {/* Card B — escape hatch (evaluate). Hidden if real data exists. */}
        {showDemo ? (
          <button
            type="button"
            disabled={loadingDemo}
            onClick={startDemo}
            className={cn(
              'group flex flex-col rounded-md border border-line bg-surface p-6 text-left transition hover:border-line-strong',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              loadingDemo ? 'cursor-wait opacity-70' : 'cursor-pointer',
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">Just looking</p>
            <h2 className="mt-2 font-display text-lg font-medium text-ink">
              {loadingDemo ? 'Loading demo…' : 'Explore with sample data'}
            </h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              load a believable month — five side projects on one card — and jump straight to the
              dashboard.
            </p>
            <span aria-hidden className="mt-4 self-end text-muted transition group-hover:translate-x-0.5">
              →
            </span>
          </button>
        ) : (
          <div className="flex flex-col justify-center rounded-md border border-dashed border-line bg-bg-alt p-6 text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">Already live</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              you’ve already got real spend in here — no need for sample data. finish setup and head
              to your dashboard.
            </p>
          </div>
        )}
      </div>

      {demoError && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          couldn’t load the demo just now — try “set it up” instead.
        </p>
      )}

      <p className="mt-6 text-xs leading-relaxed text-subtle">
        setting up creates real projects you own. the demo is sample data, clearly labeled, and
        removable.
      </p>
    </div>
  )
}
