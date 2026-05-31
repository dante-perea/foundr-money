import type { ProjectPnl } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { ColorDot } from '../ColorDot'

/**
 * One stacked horizontal bar of burn-share across the ecosystem, with a ranked
 * legend beneath it. Answers "which product is eating the budget?" at a glance.
 *
 * Pure CSS — flex segments whose width ∝ expense_cents. No chart library. The
 * Unallocated / Platform (personal) slice is muted grey so real-product share
 * reads as the story. Mirrors the PortfolioSplit / BurnByProject vocabulary.
 */
export function EcosystemBurnShare({ rows }: { rows: ProjectPnl[] }) {
  const slices = rows
    .filter((r) => r.expense_cents > 0)
    .map((r) => ({
      id: r.project_id,
      name: r.project_name,
      color: r.is_personal ? '#cbd5e1' : r.project_color,
      value: r.expense_cents,
      isPersonal: r.is_personal,
    }))
    .sort((a, b) => {
      // Real products first (by burn), platform slice always last.
      if (a.isPersonal !== b.isPersonal) return a.isPersonal ? 1 : -1
      return b.value - a.value
    })

  const total = slices.reduce((s, x) => s + x.value, 0)

  if (total === 0) {
    return (
      <div className="rounded-md border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Burn share</h2>
        <p className="mt-4 text-sm text-muted">No product spend to chart this period.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Burn share</h2>
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">This period</span>
      </div>

      {/* Stacked bar */}
      <div
        className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-bg-alt"
        role="img"
        aria-label="Share of total burn by product"
      >
        {slices.map((s) => {
          const pct = (s.value / total) * 100
          return (
            <div
              key={s.id}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              title={`${s.name} · ${formatCents(s.value)}`}
            />
          )
        })}
      </div>

      {/* Ranked legend */}
      <ul className="mt-5 flex flex-col gap-2.5">
        {slices.map((s) => {
          const pct = Math.round((s.value / total) * 100)
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <ColorDot color={s.color} />
                <span className={s.isPersonal ? 'truncate text-muted' : 'truncate text-ink'}>{s.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="tabular text-muted">{formatCents(s.value)}</span>
                <span className="tabular w-9 text-right text-subtle">{pct}%</span>
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
        Total burn <span className="tabular font-medium text-ink">{formatCents(total)}</span>
      </p>
    </div>
  )
}
