// src/lib/mcp/auth.ts
//
// Scope enforcement + CORS helpers for the foundr.money MCP endpoint.
// The route handler validates the `fm_…` bearer via verifyAgentKey (in
// '@/lib/money/agent-keys'); these helpers gate individual tool calls on the
// resolved scopes and wrap every response with the permissive, OAuth-style
// CORS headers MCP clients (Claude Code, Cursor) expect.
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { MCP_SCOPES } from '@/lib/money/constants'

export type MoneyScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES]

/** Permissive CORS headers for a stateless remote MCP server.
 *  MCP browsers preflight with the session/protocol headers below. */
export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
}

/** Clone a Response, layering the MCP CORS headers on top. */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(MCP_CORS_HEADERS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

/** 204 preflight response with the CORS headers (the route's OPTIONS handler). */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS })
}

/** 401 JSON for a missing/invalid bearer, with WWW-Authenticate + CORS. */
export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'invalid_token' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer error="invalid_token", error_description="missing or invalid fm_ bearer"',
      ...MCP_CORS_HEADERS,
    },
  })
}

/** Throw a clean MCP error when the presented key lacks the required scope.
 *  Both scopes are present on v1 keys; this still guards forward-compat
 *  read-only keys and surfaces a precise reason to the agent. */
export function requireScope(scopes: string[], scope: MoneyScope): void {
  if (!scopes.includes(scope)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `this tool requires the "${scope}" scope; the presented foundr.money key is not authorized for it`,
    )
  }
}
