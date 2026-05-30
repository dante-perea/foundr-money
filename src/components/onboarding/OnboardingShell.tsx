'use client'

import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { cn } from '@/lib/cn'

/**
 * Chrome every step shares: a hairline header with the wordmark + a global
 * "Skip setup" escape hatch, an optional progress rail, the content slot, and
 * an optional sticky footer-nav slot. The shell never moves — only the content
 * column cross-fades between steps.
 */
export function OnboardingShell({
  onSkipSetup,
  showSkip,
  skipping,
  rail,
  footer,
  wide,
  children,
}: {
  onSkipSetup: () => void
  showSkip: boolean
  skipping?: boolean
  rail?: ReactNode
  footer?: ReactNode
  /** Step 0 + Step 3 widen to 680px. */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface font-sans text-ink">
      <header className="h-16 border-b border-line">
        <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-6">
          <Wordmark href="/dashboard" />
          {showSkip && (
            <button
              type="button"
              onClick={onSkipSetup}
              disabled={skipping}
              className={cn(
                'rounded font-mono text-xs uppercase tracking-[0.18em] text-subtle transition hover:text-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                skipping && 'cursor-wait opacity-70',
              )}
            >
              <span className="max-[360px]:hidden">Skip setup →</span>
              <span className="hidden max-[360px]:inline">Skip →</span>
            </button>
          )}
        </div>
      </header>

      {rail}

      <main className="flex flex-1 flex-col">
        <div
          className={cn(
            'mx-auto flex w-full flex-1 flex-col px-6',
            wide ? 'max-w-[680px]' : 'max-w-[560px]',
          )}
        >
          {children}
        </div>
      </main>

      {footer}
    </div>
  )
}
