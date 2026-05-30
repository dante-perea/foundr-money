import Link from 'next/link'
import { PERIOD_LABELS, type Period } from '@/lib/money/pnl'
import { cn } from '@/lib/cn'

const ORDER: Period[] = ['last30', 'mtd', 'ytd', 'all']

/** Period pills. Each is a link that sets ?period= — keeps the page a pure
 *  server component (no client state needed). */
export function PeriodSelector({ active, basePath = '/dashboard' }: { active: Period; basePath?: string }) {
  return (
    <div className="inline-flex items-center rounded-md border border-line bg-surface p-1">
      {ORDER.map((p) => {
        const isActive = p === active
        return (
          <Link
            key={p}
            href={p === 'last30' ? basePath : `${basePath}?period=${p}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition',
              isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink',
            )}
          >
            {PERIOD_LABELS[p]}
          </Link>
        )
      })}
    </div>
  )
}
