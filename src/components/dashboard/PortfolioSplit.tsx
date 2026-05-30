import type { ProjectPnl } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { ColorDot } from './ColorDot'

/** Donut of expense share by project — reinforces "five projects on one card".
 *  Pure SVG (stroke-dasharray arcs), no chart library. */
export function PortfolioSplit({ rows }: { rows: ProjectPnl[] }) {
  const slices = rows
    .filter((r) => r.expense_cents > 0)
    .map((r) => ({
      id: r.project_id,
      name: r.project_name,
      // Personal stays muted so real-project share reads as the story.
      color: r.is_personal ? '#cbd5e1' : r.project_color,
      value: r.expense_cents,
      isPersonal: r.is_personal,
    }))
    .sort((a, b) => {
      if (a.isPersonal !== b.isPersonal) return a.isPersonal ? 1 : -1
      return b.value - a.value
    })

  const total = slices.reduce((s, x) => s + x.value, 0)

  if (total === 0) {
    return (
      <div className="rounded-md border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Portfolio split</h2>
        <p className="mt-4 text-sm text-muted">No expense share to chart yet.</p>
      </div>
    )
  }

  // Geometry: a stroked circle, circumference = 2πr. Each slice is a dash.
  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const arcs = slices.map((s) => {
    const fraction = s.value / total
    const dash = fraction * circumference
    const arc = {
      ...s,
      fraction,
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: -offset,
    }
    offset += dash
    return arc
  })

  return (
    <div className="rounded-md border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Portfolio split</h2>
      <p className="mt-1 text-sm text-muted">Expense share, this period.</p>

      <div className="mt-6 flex items-center gap-6">
        <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label="Expense share by project">
          {arcs.map((a) => (
            <circle
              key={a.id}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth="18"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
            />
          ))}
          {/* Center hole hairline for a crisp donut edge */}
          <circle cx="80" cy="80" r={radius - 9} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </svg>

        <ul className="min-w-0 flex-1 flex flex-col gap-2">
          {arcs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <ColorDot color={a.color} />
                <span className={a.isPersonal ? 'truncate text-muted' : 'truncate text-ink'}>{a.name}</span>
              </span>
              <span className="tabular shrink-0 text-muted">{Math.round(a.fraction * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
        Total burn <span className="tabular font-medium text-ink">{formatCents(total)}</span>
      </p>
    </div>
  )
}
