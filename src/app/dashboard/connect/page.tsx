import { requireOwnerId } from '@/lib/money/owner'
import { listAgentKeys } from '@/lib/money/agent-keys'
import { db } from '@/lib/money/db'
import type { AccountProvider } from '@/lib/money/types'
import { ConnectClient, type ConnectedAccountView } from './connect-client'
import type { AgentKeyView } from '@/components/connect/McpSection'

export const metadata = {
  title: 'Connect · foundr.money',
}

async function listConnectedAccounts(owner: string): Promise<ConnectedAccountView[]> {
  const { data, error } = await db()
    .from('financial_accounts')
    .select('id, provider, display_name, last4, created_at')
    .eq('owner_id', owner)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((a) => {
    const row = a as {
      id: string
      provider: AccountProvider
      display_name: string
      last4: string | null
    }
    return { id: row.id, provider: row.provider, display_name: row.display_name, last4: row.last4 }
  })
}

export default async function ConnectPage() {
  const owner = await requireOwnerId()

  const [keyRows, accounts] = await Promise.all([listAgentKeys(owner), listConnectedAccounts(owner)])

  const keys: AgentKeyView[] = keyRows.map((k) => ({
    id: k.id,
    label: k.label,
    status: k.status,
    last_used_at: k.last_used_at,
    created_at: k.created_at,
  }))

  return (
    <ConnectClient keys={keys} accounts={accounts} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''} />
  )
}
