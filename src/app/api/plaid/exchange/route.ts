// src/app/api/plaid/exchange/route.ts
//
// POST { public_token } → exchanges it for a Plaid access_token + item_id,
// persists a plaid_items row and a financial_accounts row (provider 'plaid',
// kind 'card'), then kicks an initial /transactions/sync. Guarded on missing
// creds. Returns { ok: true } on success.
import { connection } from 'next/server'
import { CountryCode } from 'plaid'
import { requireOwnerId } from '@/lib/money/owner'
import { db } from '@/lib/money/db'
import { encrypt } from '@/lib/money/crypto'
import { plaidClient, plaidConfigured, syncPlaidItem } from '@/lib/money/ingest/plaid'

export async function POST(req: Request): Promise<Response> {
  await connection()

  let owner: string
  try {
    owner = await requireOwnerId()
  } catch {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (!plaidConfigured()) {
    return Response.json({ error: 'plaid_not_configured' }, { status: 200 })
  }

  let body: { public_token?: string }
  try {
    body = (await req.json()) as { public_token?: string }
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }
  const publicToken = body.public_token?.trim()
  if (!publicToken) {
    return Response.json({ error: 'missing_public_token' }, { status: 400 })
  }

  try {
    const client = plaidClient()
    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken })
    const accessToken = exchange.data.access_token
    const itemId = exchange.data.item_id

    // Institution name (best-effort; sandbox returns it).
    let institutionName: string | null = null
    let last4: string | null = null
    let plaidAccountId: string | null = null
    let accountName = 'Plaid card'
    try {
      const accountsResp = await client.accountsGet({ access_token: accessToken })
      const acct = accountsResp.data.accounts[0]
      if (acct) {
        last4 = acct.mask ?? null
        plaidAccountId = acct.account_id
        accountName = acct.official_name ?? acct.name ?? accountName
      }
      const insId = accountsResp.data.item.institution_id
      if (insId) {
        const inst = await client.institutionsGetById({
          institution_id: insId,
          country_codes: [CountryCode.Us],
        })
        institutionName = inst.data.institution.name ?? null
      }
    } catch {
      // best-effort enrichment only
    }

    // Persist plaid_items (upsert on the item_id PK). The access_token is
    // encrypted at rest (AES-256-GCM) — real tokens are encrypted going
    // forward; decrypted on read in syncPlaidItem.
    await db()
      .from('plaid_items')
      .upsert(
        {
          item_id: itemId,
          owner_id: owner,
          access_token: encrypt(accessToken),
          institution_name: institutionName,
          status: 'active',
        },
        { onConflict: 'item_id' },
      )

    // Persist the financial_accounts row (provider 'plaid', kind 'card').
    await db()
      .from('financial_accounts')
      .insert({
        owner_id: owner,
        provider: 'plaid',
        kind: 'card',
        display_name: institutionName ? `${institutionName} ${accountName}`.trim() : accountName,
        last4,
        plaid_item_id: itemId,
        plaid_account_id: plaidAccountId,
        status: 'active',
      })

    // Initial sync (await so the dashboard is populated on first load).
    const sync = await syncPlaidItem(owner, itemId)

    return Response.json({ ok: true, item_id: itemId, synced: sync.added })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'exchange_failed'
    return Response.json({ error: 'exchange_failed', detail: message }, { status: 200 })
  }
}
