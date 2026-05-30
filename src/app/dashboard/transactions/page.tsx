import { requireOwnerId } from '@/lib/money/owner'
import { listTransactions } from '@/lib/money/transactions'
import { listProjects } from '@/lib/money/projects'
import { db } from '@/lib/money/db'
import type { Category } from '@/lib/money/types'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { TransactionsClient } from './transactions-client'

export const metadata = {
  title: 'Transactions · foundr.money',
}

type FilterParam = 'all' | 'untagged'

async function listSystemCategories(): Promise<Category[]> {
  const { data, error } = await db()
    .from('categories')
    .select('*')
    .is('owner_id', null)
    .order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const owner = await requireOwnerId()
  const { filter: rawFilter } = await searchParams
  const filter: FilterParam = rawFilter === 'untagged' ? 'untagged' : 'all'

  const [txns, projects, categories] = await Promise.all([
    listTransactions(owner, { limit: 200 }),
    listProjects(owner),
    listSystemCategories(),
  ])

  // Freshly-onboarded: no charges have landed yet. Show an intentional empty
  // state rather than an empty table with filter tabs reading "0".
  if (txns.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Transactions</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            tag in the loop you make decisions
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Every charge lands here untagged, ready to assign to a project in one click.
          </p>
        </div>

        <EmptyState
          icon="⌘"
          eyebrow="No transactions yet"
          title="Your spend will show up here."
          description="Connect a card and charges flow in automatically — or tag spend straight from Claude Code and Cursor with the MCP, while you build."
          primary={{ label: 'Connect an account', href: '/dashboard/connect' }}
          secondary={{ label: 'Tag from your editor', href: '/dashboard/connect' }}
        />
      </div>
    )
  }

  return (
    <TransactionsClient
      txns={txns}
      projects={projects}
      categories={categories}
      initialFilter={filter}
    />
  )
}
