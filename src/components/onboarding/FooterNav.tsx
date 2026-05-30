'use client'

import { cn } from '@/lib/cn'

/**
 * Sticky footer nav shared by steps 1–2. Back on the left; a bare "skip step"
 * link + the primary Continue on the right. Continue is gated by CONTENT rules
 * only (e.g. step 1 needs ≥1 project) — never globally disabled on an in-flight
 * server call. On mobile it sticks to the bottom and respects the safe area.
 */
export function FooterNav({
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  continueHint,
  onSkipStep,
  skipLabel = 'skip step',
}: {
  onBack: () => void
  onContinue: () => void
  continueLabel: string
  continueDisabled?: boolean
  /** Visually-hidden reason Continue is disabled (for screen readers). */
  continueHint?: string
  onSkipStep?: () => void
  skipLabel?: string
}) {
  return (
    <nav
      aria-label="Onboarding"
      className="sticky bottom-0 border-t border-line bg-surface/95 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[560px] items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          ← Back
        </button>

        <div className="flex items-center gap-3">
          {onSkipStep && (
            <button
              type="button"
              onClick={onSkipStep}
              className="rounded text-sm text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {skipLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (continueDisabled) return
              onContinue()
            }}
            aria-disabled={continueDisabled}
            aria-describedby={continueDisabled && continueHint ? 'continue-hint' : undefined}
            className={cn(
              'rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              continueDisabled && 'cursor-not-allowed opacity-50 hover:bg-accent',
            )}
          >
            {continueLabel}
          </button>
          {continueDisabled && continueHint && (
            <span id="continue-hint" className="sr-only">
              {continueHint}
            </span>
          )}
        </div>
      </div>
    </nav>
  )
}
