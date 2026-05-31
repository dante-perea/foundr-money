'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { clearDemoDataAction } from '@/app/dashboard/demo-actions'

/**
 * "You're exploring with sample data" — the honest, removable label the
 * onboarding StepWelcome promises. Rendered by the dashboard only when the
 * owner is on the sample-data path AND demo rows still exist.
 *
 * Two exits: dismiss (hide for this view; the data stays) or clear (delete every
 * sample row, then refresh the route so the dashboard re-renders into its real
 * empty state). Clearing is destructive but scoped to demo rows only, so it's a
 * single confident action — no modal.
 */
export function DemoBanner() {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState(false)
  const [isClearing, startClearing] = useTransition()

  if (dismissed) return null

  function clear() {
    setError(false)
    startClearing(async () => {
      try {
        await clearDemoDataAction()
        // Real rows are gone; re-render the dashboard against fresh DB state.
        router.refresh()
      } catch {
        setError(true)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-accent/40 bg-accent/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Sample data</p>
        <p className="text-sm text-ink">
          You&apos;re exploring with sample data.{' '}
          <span className="text-muted">
            Five demo projects on one card — clear it whenever you&apos;re ready for the real thing.
          </span>
        </p>
        {error && (
          <p className="mt-1 text-xs text-warning">
            Couldn&apos;t clear the sample data just now — try again.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={isClearing}
          className="rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isClearing}
          className={cn(
            'rounded-md border border-[#dc2626] px-4 py-2 text-sm font-medium text-[#dc2626] transition hover:bg-[#fef2f2]',
            isClearing ? 'cursor-wait opacity-70' : 'cursor-pointer',
          )}
        >
          {isClearing ? 'Clearing…' : 'Clear sample data'}
        </button>
      </div>
    </div>
  )
}
