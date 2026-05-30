'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { PlaidConnectButton } from '@/components/connect/PlaidConnectButton'
import { recordInterest } from '@/app/onboarding/actions'

/**
 * (iii) Connect a bank — honest Plaid. When configured, the real Plaid Link
 * button (reused from the dashboard). When NOT configured, a calm "coming soon"
 * note that IS the affordance — never a fake/disabled button, never a fake
 * popup, never a fake "Connected" chip — plus a "notify me" ghost.
 */
export function BankConnectCard({ plaidConfigured }: { plaidConfigured: boolean }) {
  const [pending, startInterest] = useTransition()
  const [notified, setNotified] = useState(false)

  function notify() {
    if (notified) return
    startInterest(async () => {
      await recordInterest('plaid')
      setNotified(true)
    })
  }

  return (
    <article className="rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">🏦 Automatic</p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]',
            plaidConfigured ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
          )}
        >
          {plaidConfigured ? 'available' : 'coming soon'}
        </span>
      </div>
      <h2 className="mt-2 font-display text-lg font-medium text-ink">Connect a bank</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        link the card you actually spend on and let charges flow in automatically. AI/cloud line
        items — OpenAI, Anthropic, Vercel, Supabase — come in as first-class spend. personal cards
        welcome — no business account, no entity.
      </p>

      {plaidConfigured ? (
        <div className="mt-5">
          <PlaidConnectButton />
          <p className="mt-3 text-xs text-subtle">read-only. we never move money.</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="rounded-md border border-dashed border-line bg-bg-alt p-4 text-sm text-muted">
            bank linking is coming soon — the sandbox isn’t wired up yet. for now, tag from your
            editor or add expenses by hand — it’s faster than it sounds.
          </div>
          <button
            type="button"
            onClick={notify}
            disabled={pending || notified}
            className={cn(
              'mt-3 rounded text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              notified ? 'text-success' : 'text-accent hover:text-accent-hover',
              pending && 'cursor-wait opacity-70',
            )}
          >
            {notified ? 'we’ll let you know ✓' : 'notify me when it’s live'}
          </button>
        </div>
      )}
    </article>
  )
}
