import { requireOwnerId } from '@/lib/money/owner'
import { db } from '@/lib/money/db'
import { SettingsClient, type AccountView } from './settings-client'

export const metadata = {
  title: 'Settings · foundr.money',
}

/** Owner-scoped list of connected financial accounts for the settings surface. */
async function listAccounts(owner: string): Promise<AccountView[]> {
  const { data, error } = await db()
    .from('financial_accounts')
    .select('id, provider, display_name, last4, created_at')
    .eq('owner_id', owner)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((a) => {
    const row = a as { id: string; provider: string; display_name: string; last4: string | null }
    return { id: row.id, provider: row.provider, display_name: row.display_name, last4: row.last4 }
  })
}

/**
 * Account settings. `requireOwnerId()` (connection() + auth()) marks this route
 * dynamic — correct for a personalized, owner-scoped surface under
 * cacheComponents. The danger-zone interactions live in the client child.
 */
export default async function SettingsPage() {
  const owner = await requireOwnerId()
  const accounts = await listAccounts(owner)
  return <SettingsClient accounts={accounts} />
}
