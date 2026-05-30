import { requireOwnerId } from '@/lib/money/owner'
import { portfolioPnl, portfolioTotals, type Period } from '@/lib/money/pnl'
import { listUntagged } from '@/lib/money/transactions'
import { db } from '@/lib/money/db'
import { StatCard } from '@/components/dashboard/StatCard'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { BurnByProject } from '@/components/dashboard/BurnByProject'
import { PortfolioSplit } from '@/components/dashboard/PortfolioSplit'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { formatCents } from '@/lib/money/money'

const PERIODS: Period[] = ['last30', 'mtd', 'ytd', 'all']

function parsePeriod(raw: string | string[] | undefined): Period {
  const v = Array.isArray(raw) ? raw[0] : raw
  return PERIODS.includes(v as Period) ? (v as Period) : 'last30'
}

/** Count of connected Stripe accounts — drives the MRR caption.
 *  Cheap, owner-scoped read; keeps the "combined MRR" stat honest. */
async function countStripeAccounts(ownerId: string): Promise<number> {
  const { count } = await db()
    .from('financial_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('provider', 'stripe')
  return count ?? 0
}

export default async function DashboardOverview({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>
}) {
  const owner = await requireOwnerId()
  const sp = await searchParams
  const period = parsePeriod(sp.period)

  const [rows, untagged, stripeAccounts] = await Promise.all([
    portfolioPnl(owner, period),
    listUntagged(owner, { limit: 500 }),
    countStripeAccounts(owner),
  ])
  const totals = await portfolioTotals(rows, untagged.length)

  const netPositive = totals.net_cents >= 0

  // Freshly-onboarded / no spend yet: nothing to chart this period (projects
  // may exist from onboarding, but no transactions/MRR). Render an intentional
  // empty state with real next steps instead of a wall of zeros.
  const isEmpty =
    totals.expense_cents === 0 && totals.income_cents === 0 && totals.mrr_cents === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Portfolio</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Every project&apos;s burn, one card.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Nothing&apos;s flowing in yet. Connect the card you actually spend on, then
            see which project caused that bill.
          </p>
        </div>

        <EmptyState
          icon="＄"
          eyebrow="No spend yet"
          title="Bring in your first dollar."
          description="Connect a card and your charges flow in — untagged, ready to split across your projects. Or tag spend straight from Claude Code with the MCP."
          primary={{ label: 'Connect an account', href: '/dashboard/connect' }}
          secondary={{ label: 'Tag from your editor', href: '/dashboard/connect' }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Portfolio</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Every project&apos;s burn, one card.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            {totals.project_count} {totals.project_count === 1 ? 'project' : 'projects'} on one balance.
            See which one caused that bill.
          </p>
        </div>
        <PeriodSelector active={period} />
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total burn" value={formatCents(totals.expense_cents)} caption="Expenses this period" />
        <StatCard
          label="Net"
          value={formatCents(totals.net_cents, 'usd', { signed: true })}
          valueClassName={netPositive ? 'text-success' : 'text-ink'}
          caption={netPositive ? 'In the black' : 'Income minus burn'}
        />
        <StatCard
          label="Combined MRR"
          value={formatCents(totals.mrr_cents)}
          caption={`Across ${stripeAccounts} Stripe ${stripeAccounts === 1 ? 'account' : 'accounts'}`}
        />
        <StatCard
          label="Untagged"
          value={String(totals.untagged_count)}
          valueClassName={totals.untagged_count > 0 ? 'text-warning' : 'text-ink'}
          caption={totals.untagged_count > 0 ? 'Need a project — tag them' : 'All spend assigned'}
          href="/dashboard/transactions?filter=untagged"
        />
      </div>

      {/* Burn by project + split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <BurnByProject rows={rows} />
        <PortfolioSplit rows={rows} />
      </div>
    </div>
  )
}
