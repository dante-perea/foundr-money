import Link from 'next/link'
import type { ProjectPnl } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { ColorDot } from '../ColorDot'

/**
 * The headline per-product ledger: one row per foundr.* product, ranked by
 * burn (expense) descending. The Unallocated / Platform (personal) row is
 * pulled out and rendered distinctly muted at the very bottom — spend that
 * isn't yet pinned to a product reads as a gentle nudge, not a project.
 *
 * Money is always `tabular`. Net is signed + green when in the black. Each
 * product row links to its detail page so the table is a launch pad, not a
 * dead end. Responsive: a real table on >= sm, stacked cards on mobile.
 */
export function EcosystemTable({ rows }: { rows: ProjectPnl[] }) {
  const products = rows
    .filter((r) => !r.is_personal)
    .sort((a, b) => b.expense_cents - a.expense_cents)
  const platform = rows.filter((r) => r.is_personal && (r.expense_cents > 0 || r.income_cents > 0 || r.txn_count > 0))

  const totalExpense = products.reduce((s, r) => s + r.expense_cents, 0)

  const ordered = [...products, ...platform]

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* ── Desktop: table ─────────────────────────────────────────────── */}
      <table className="hidden w-full border-collapse sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-6 py-4 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-subtle">
              Product
            </th>
            <th className="px-6 py-4 text-right font-mono text-[0.7rem] uppercase tracking-[0.18em] text-subtle">
              Burn
            </th>
            <th className="px-6 py-4 text-right font-mono text-[0.7rem] uppercase tracking-[0.18em] text-subtle">
              Net
            </th>
            <th className="px-6 py-4 text-right font-mono text-[0.7rem] uppercase tracking-[0.18em] text-subtle">
              MRR
            </th>
            <th className="px-6 py-4 text-right font-mono text-[0.7rem] uppercase tracking-[0.18em] text-subtle">
              Txns
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => (
            <EcosystemRow key={r.project_id} row={r} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line-strong">
            <td className="px-6 py-4 text-sm font-medium text-ink">
              Total across {products.length} {products.length === 1 ? 'product' : 'products'}
            </td>
            <td className="tabular px-6 py-4 text-right text-sm font-semibold text-ink">
              {formatCents(totalExpense)}
            </td>
            <td className="px-6 py-4" />
            <td className="px-6 py-4" />
            <td className="px-6 py-4" />
          </tr>
        </tfoot>
      </table>

      {/* ── Mobile: stacked cards ──────────────────────────────────────── */}
      <ul className="divide-y divide-line sm:hidden">
        {ordered.map((r) => (
          <li key={r.project_id}>
            <EcosystemCard row={r} />
          </li>
        ))}
        <li className="flex items-center justify-between bg-bg-alt px-5 py-4">
          <span className="text-sm font-medium text-ink">
            Total · {products.length} {products.length === 1 ? 'product' : 'products'}
          </span>
          <span className="tabular text-sm font-semibold text-ink">{formatCents(totalExpense)}</span>
        </li>
      </ul>
    </div>
  )
}

function EcosystemRow({ row }: { row: ProjectPnl }) {
  const isPlatform = row.is_personal
  const netPositive = row.net_cents >= 0
  return (
    <tr className="group border-b border-line last:border-b-0 transition hover:bg-bg-alt">
      <td className="px-6 py-4">
        <NameCell row={row} />
      </td>
      <td className="tabular px-6 py-4 text-right text-sm font-medium text-ink">
        {formatCents(row.expense_cents)}
      </td>
      <td className="tabular px-6 py-4 text-right text-sm">
        <span className={netPositive ? 'text-success' : 'text-ink'}>
          {formatCents(row.net_cents, 'usd', { signed: true })}
        </span>
      </td>
      <td className="tabular px-6 py-4 text-right text-sm text-ink">
        {row.mrr_cents > 0 ? formatCents(row.mrr_cents) : <span className="text-subtle">—</span>}
      </td>
      <td className={`tabular px-6 py-4 text-right text-sm ${isPlatform ? 'text-subtle' : 'text-muted'}`}>
        {row.txn_count}
      </td>
    </tr>
  )
}

function EcosystemCard({ row }: { row: ProjectPnl }) {
  const netPositive = row.net_cents >= 0
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <NameCell row={row} />
        <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatCents(row.expense_cents)}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="tabular">
          net{' '}
          <span className={netPositive ? 'text-success' : 'text-ink'}>
            {formatCents(row.net_cents, 'usd', { signed: true })}
          </span>
        </span>
        {row.mrr_cents > 0 ? (
          <span className="tabular">
            MRR <span className="text-ink">{formatCents(row.mrr_cents)}</span>
          </span>
        ) : null}
        <span className="tabular text-subtle">
          {row.txn_count} {row.txn_count === 1 ? 'txn' : 'txns'}
        </span>
      </div>
    </div>
  )
}

/** Color dot + name. Products link to their detail page; the platform row is
 *  muted and inert (it isn't a real project you can drill into). */
function NameCell({ row }: { row: ProjectPnl }) {
  if (row.is_personal) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <ColorDot color="#cbd5e1" />
        <span className="truncate text-sm font-medium text-muted">{row.project_name}</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-subtle">Platform</span>
      </span>
    )
  }
  return (
    <Link
      href={`/dashboard/projects/${row.project_slug}`}
      className="flex min-w-0 items-center gap-2.5 transition group-hover:text-accent"
    >
      <ColorDot color={row.project_color} />
      <span className="truncate text-sm font-medium text-ink transition group-hover:text-accent">
        {row.project_name}
      </span>
    </Link>
  )
}
