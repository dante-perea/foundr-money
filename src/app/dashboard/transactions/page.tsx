import { requireOwnerId } from '@/lib/money/owner'
import { listTransactions } from '@/lib/money/transactions'
import { listProjects } from '@/lib/money/projects'
import { db } from '@/lib/money/db'
import type { Category } from '@/lib/money/types'
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

  return (
    <TransactionsClient
      txns={txns}
      projects={projects}
      categories={categories}
      initialFilter={filter}
    />
  )
}
