import Link from 'next/link'
import { requireOwnerId } from '@/lib/money/owner'
import { portfolioPnl, type Period } from '@/lib/money/pnl'
import { formatCents, formatCompact } from '@/lib/money/money'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { StatCard } from '@/components/dashboard/StatCard'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { EcosystemTable } from '@/components/dashboard/ecosystem/EcosystemTable'
import { EcosystemBurnShare } from '@/components/dashboard/ecosystem/EcosystemBurnShare'

const PERIODS: Period[] = ['last30', 'mtd', 'ytd', 'all']

function parsePeriod(raw: string | string[] | undefined): Period {
  const v = Array.isArray(raw) ? raw[0] : raw
  return PERIODS.includes(v as Period) ? (v as Period) : 'last30'
}

/**
 * The "track my whole ecosystem" screen: what is each foundr.* product
 * costing me? Pulls per-project P&L for the period and ranks every
 * non-personal product by burn, with a stacked burn-share bar and a clean
 * ledger table. Unallocated / Platform spend is shown distinctly, muted.
 *
 * Server component. `requireOwnerId()` (via `auth()`) marks the route dynamic.
 */
export default async function EcosystemPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>
}) {
  const owner = await requireOwnerId()
  const sp = await searchParams
  const period = parsePeriod(sp.period)

  const rows = await portfolioPnl(owner, period)

  const products = rows.filter((r) => !r.is_personal)
  const totalBurn = products.reduce((s, r) => s + r.expense_cents, 0)
  const totalMrr = products.reduce((s, r) => s + r.mrr_cents, 0)

  // Empty when no product carries any tracked spend this period. (Projects may
  // exist from onboarding with zero activity — that's still "no spend".)
  const hasProductSpend = products.some((r) => r.expense_cents > 0)

  const topBurner = [...products].sort((a, b) => b.expense_cents - a.expense_cents)[0]

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Ecosystem</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            What each project is burning.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Every foundr.* product, ranked by spend. The whole ecosystem on one screen.
          </p>
        </div>
        <PeriodSelector active={period} basePath="/dashboard/ecosystem" />
      </div>

      {!hasProductSpend ? (
        <EmptyState
          icon="◇"
          eyebrow="No ecosystem spend yet"
          title="Nothing's burning yet."
          description="No ecosystem spend tracked yet — connect Vercel on Connect and run a sync to see what each product costs you."
          primary={{ label: 'Connect a provider', href: '/dashboard/connect' }}
        />
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Ecosystem burn"
              value={formatCents(totalBurn)}
              caption={`Across ${products.length} ${products.length === 1 ? 'product' : 'products'}`}
            />
            <StatCard
              label="Top burner"
              value={topBurner ? formatCompact(topBurner.expense_cents) : '—'}
              caption={topBurner ? topBurner.project_name : 'No product spend'}
            />
            <StatCard
              label="Combined MRR"
              value={formatCents(totalMrr)}
              caption="Recurring revenue, normalized monthly"
            />
          </div>

          {/* Ledger + burn share */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <EcosystemTable rows={rows} />
            <EcosystemBurnShare rows={rows} />
          </div>

          <p className="text-sm text-muted">
            Missing a product?{' '}
            <Link href="/dashboard/connect" className="text-accent transition hover:text-accent-hover">
              Connect a provider
            </Link>{' '}
            or{' '}
            <Link
              href="/dashboard/transactions?filter=untagged"
              className="text-accent transition hover:text-accent-hover"
            >
              tag untagged spend
            </Link>{' '}
            to pin it to the right project.
          </p>
        </>
      )}
    </div>
  )
}
