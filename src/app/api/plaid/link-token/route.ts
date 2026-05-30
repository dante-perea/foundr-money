// src/app/api/plaid/link-token/route.ts
//
// POST → mints a Plaid Link token for the signed-in founder. The browser opens
// Plaid Link with this token; on success the public_token is POSTed to
// /api/plaid/exchange. Guarded on missing creds: returns a clean
// { error: 'plaid_not_configured' } (200) so the connect page degrades nicely.
import { connection } from 'next/server'
import {
  CountryCode,
  Products,
} from 'plaid'
import { requireOwnerId } from '@/lib/money/owner'
import { plaidClient, plaidConfigured } from '@/lib/money/ingest/plaid'

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

  const origin = new URL(req.url).origin
  try {
    const resp = await plaidClient().linkTokenCreate({
      user: { client_user_id: owner },
      client_name: 'foundr.money',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: `${origin}/api/plaid/webhook`,
    })
    return Response.json({ link_token: resp.data.link_token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'link_token_failed'
    return Response.json({ error: 'link_token_failed', detail: message }, { status: 200 })
  }
}
