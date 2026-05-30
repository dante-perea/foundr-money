import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOwnerId } from '@/lib/money/owner'
import { getProjectBySlug } from '@/lib/money/projects'
import { portfolioPnl } from '@/lib/money/pnl'
import { listTransactions } from '@/lib/money/transactions'
import type { ProjectPnl } from '@/lib/money/types'
import { formatCents } from '@/lib/money/money'
import { StatCard } from '@/components/dashboard/StatCard'
import { ColorDot } from '@/components/dashboard/ColorDot'
import { TransactionRow } from '@/components/dashboard/TransactionRow'

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const owner = await requireOwnerId()

  const project = await getProjectBySlug(owner, slug)
  if (!project) notFound()

  // All-time P&L for this project + recent transactions allocated to it.
  const [rows, all] = await Promise.all([
    portfolioPnl(owner, 'all'),
    listTransactions(owner, { limit: 300 }),
  ])

  const pnl: ProjectPnl = rows.find((r) => r.project_slug === slug) ?? {
    project_id: project.id,
    project_name: project.name,
    project_slug: project.slug,
    project_color: project.color,
    is_personal: project.is_personal,
    income_cents: 0,
    expense_cents: 0,
    net_cents: 0,
    mrr_cents: 0,
    txn_count: 0,
  }

  const txns = all.filter((t) => t.allocations.some((a) => a.project_slug === slug))
  const netPositive = pnl.net_cents >= 0

  return (
    <div className="flex flex-col gap-8">
      {/* Back link */}
      <div>
        <Link href="/dashboard" className="text-sm text-muted transition hover:text-ink">
          ← Portfolio
        </Link>
      </div>

      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
          {project.is_personal ? 'Unallocated' : 'Project'}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <ColorDot color={project.color} size="lg" />
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {project.name}
          </h1>
        </div>
        {project.description ? <p className="mt-3 max-w-xl text-sm text-muted">{project.description}</p> : null}
      </div>

      {/* P&L cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={formatCents(pnl.income_cents)} caption="Revenue, all time" />
        <StatCard label="Expenses" value={formatCents(pnl.expense_cents)} caption="Burn, all time" />
        <StatCard
          label="Net"
          value={formatCents(pnl.net_cents, 'usd', { signed: true })}
          valueClassName={netPositive ? 'text-success' : 'text-ink'}
          caption={netPositive ? 'In the black' : 'Income minus burn'}
        />
        <StatCard
          label="MRR"
          value={formatCents(pnl.mrr_cents)}
          caption={pnl.mrr_cents > 0 ? 'Recurring, monthly' : 'No subscriptions'}
        />
      </div>

      {/* Transactions */}
      <div className="rounded-md border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Transactions</h2>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
            {txns.length} shown
          </span>
        </div>
        {txns.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nothing tagged to this project yet. Tag transactions from the{' '}
            <Link href="/dashboard/transactions" className="text-accent hover:text-accent-hover">
              transactions
            </Link>{' '}
            view or via an agent over MCP.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col">
            {txns.map((t) => (
              <TransactionRow key={t.id} txn={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
