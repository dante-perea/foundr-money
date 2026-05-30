// src/app/api/mcp/money/route.ts
//
// Remote MCP endpoint for foundr.money. Stateless Streamable HTTP, static
// `fm_…` bearer auth (one key == one founder). Connect from an agent with:
//   claude mcp add --transport http foundr-money \
//     https://foundr-money.vercel.app/api/mcp/money \
//     --header "Authorization: Bearer fm_…"
import { connection } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { verifyAgentKey } from '@/lib/money/agent-keys'
import { createMoneyMcpServer } from '@/lib/mcp/money-server'
import { corsPreflight, unauthorized, withCors } from '@/lib/mcp/auth'

function bearerFrom(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

async function handle(req: Request): Promise<Response> {
  // Required under cacheComponents before any dynamic work / auth lookup.
  await connection()

  const token = bearerFrom(req)
  const v = token ? await verifyAgentKey(token) : null
  if (!v) return unauthorized()

  const server = createMoneyMcpServer({ ownerId: v.ownerId, keyId: v.keyId, scopes: v.scopes })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return withCors(await transport.handleRequest(req))
}

export const POST = handle
export const GET = handle
export const OPTIONS = (): Response => corsPreflight()
