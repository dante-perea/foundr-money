import Link from 'next/link'
import type { ProjectPnl } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { ColorDot } from './ColorDot'

/** Horizontal burn bars — one row per project, width ∝ expense_cents.
 *  Personal/Unallocated is shown last and muted so unassigned spend is visible.
 *  Pure CSS bars, no chart library. Each project row links to its detail page. */
export function BurnByProject({ rows }: { rows: ProjectPnl[] }) {
  const projects = rows.filter((r) => !r.is_personal)
  const personal = rows.filter((r) => r.is_personal)
  // Stable, readable ordering: biggest burn first, then the muted personal rows.
  const ordered = [
    ...projects.sort((a, b) => b.expense_cents - a.expense_cents),
    ...personal,
  ]

  const max = Math.max(1, ...ordered.map((r) => r.expense_cents))

  if (ordered.every((r) => r.expense_cents === 0 && r.income_cents === 0)) {
    return (
      <div className="rounded-md border border-line bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Burn by project</h2>
        <p className="mt-4 text-sm text-muted">
          No spend in this period yet. Connect an account or import a CSV to see where the money goes.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Burn by project</h2>
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">{ordered.length} projects</span>
      </div>

      <ul className="mt-6 flex flex-col gap-5">
        {ordered.map((r) => {
          const pct = Math.round((r.expense_cents / max) * 100)
          const isPersonal = r.is_personal
          const netPositive = r.net_cents >= 0
          return (
            <li key={r.project_id}>
              <Link
                href={`/dashboard/projects/${r.project_slug}`}
                className="group block rounded -mx-2 px-2 py-1 transition hover:bg-bg-alt"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ColorDot color={r.project_color} />
                    <span
                      className={
                        isPersonal
                          ? 'truncate text-sm font-medium text-muted'
                          : 'truncate text-sm font-medium text-ink'
                      }
                    >
                      {r.project_name}
                    </span>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium text-ink">
                    {formatCents(r.expense_cents)}
                  </span>
                </div>

                {/* Bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-alt">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.max(pct, r.expense_cents > 0 ? 2 : 0)}%`,
                      backgroundColor: isPersonal ? '#cbd5e1' : r.project_color,
                    }}
                  />
                </div>

                {/* Sub-line: net + MRR */}
                <div className="mt-1.5 flex items-center gap-4 text-xs text-muted">
                  <span className="tabular">
                    net{' '}
                    <span className={netPositive ? 'text-success' : 'text-ink'}>
                      {formatCents(r.net_cents, 'usd', { signed: true })}
                    </span>
                  </span>
                  {r.mrr_cents > 0 ? (
                    <span className="tabular">
                      MRR <span className="text-ink">{formatCents(r.mrr_cents)}</span>
                    </span>
                  ) : null}
                  <span className="tabular text-subtle">
                    {r.txn_count} {r.txn_count === 1 ? 'txn' : 'txns'}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
