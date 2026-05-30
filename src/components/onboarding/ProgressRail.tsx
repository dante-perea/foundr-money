import { cn } from '@/lib/cn'

// 4-node dot rail — discrete reads as "small, finite, skippable" better than a
// percentage thermometer. Shown on steps 1–3 only (the welcome fork is not a
// numbered step). A hollow accent node encodes "skipped but passed".

const STEP_LABELS = ['welcome', 'your projects', 'bring in your spend', 'you’re set'] as const

export type RailNode = 'done' | 'current' | 'upcoming' | 'skipped'

export function ProgressRail({
  current, // 1-based step index among 1..3 that is active
  skipped,
}: {
  current: 1 | 2 | 3
  skipped: ReadonlySet<number>
}) {
  // Four nodes (indices 0..3). Node 0 = welcome (always done once you're past it).
  const nodes: RailNode[] = [0, 1, 2, 3].map((i) => {
    if (i < current) return skipped.has(i) ? 'skipped' : 'done'
    if (i === current) return 'current'
    return 'upcoming'
  })

  const label = STEP_LABELS[current]

  return (
    <div className="mx-auto w-full max-w-[560px] px-6 pb-6 pt-10">
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label="Onboarding progress"
        className="flex items-center"
      >
        {nodes.map((state, i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <span
              aria-hidden
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full transition sm:h-2.5 sm:w-2.5',
                'max-sm:h-2 max-sm:w-2',
                state === 'done' && 'bg-accent',
                state === 'current' && 'bg-accent ring-4 ring-accent/15',
                state === 'upcoming' && 'bg-line',
                state === 'skipped' && 'border border-accent bg-surface',
              )}
            />
            {i < nodes.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mx-1 h-px flex-1 transition-[background-color] duration-300',
                  i < current ? 'bg-accent' : 'bg-line',
                )}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-subtle">
        step {current} of 3 · {label}
      </p>
    </div>
  )
}
