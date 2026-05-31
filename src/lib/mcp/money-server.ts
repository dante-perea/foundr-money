// src/lib/mcp/money-server.ts
//
// MCP server factory for the foundr.money endpoint (/api/mcp/money).
// Stateless, owner-scoped. Registers SIX tools; every call enforces scope,
// derives ownerId from ctx (never from args), and audit-logs into mcp_call_log.
import { z } from 'zod'
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { auditLog, type MoneyToolCtx, type ToolResult } from './tools/_shared'
import { listUntaggedInput, runListUntagged } from './tools/list-untagged'
import { tagTransactionInput, runTagTransaction } from './tools/tag-transaction'
import { createProjectInput, runCreateProject } from './tools/create-project'
import { projectPnlInput, runProjectPnl } from './tools/project-pnl'
import { logExpenseInput, runLogExpense } from './tools/log-expense'
import { importInvoiceInput, runImportInvoice } from './tools/import-invoice'

const INSTRUCTIONS = `foundr.money — per-project P&L for the founder running several things on one card. No legal entity required: every charge is tagged to a project, and burn / income / net / MRR roll up per project.

Money is integer cents. House sign convention: an EXPENSE is positive, income is negative. Dollar inputs (log_expense.amount) are positive dollars.

When the founder is deciding what a charge was for: call list_untagged to see charges still sitting in Personal / Unallocated, then tag_transaction (by id) to assign each one to the right project. To track a project that doesn't exist yet, create_project first. For spend that never hit a connected account (cash, reimbursements), use log_expense. To answer "how much is X burning / making", use project_pnl. When the founder pastes an AI/cloud usage invoice (OpenAI, Anthropic, Cursor, Vercel, Supabase, or any Stripe invoice JSON), use import_invoice to break it into first-class per-line-item charges and reconcile it against the paying card charge.

Tools (and the scope each needs):
- list_untagged (mcp:money:read) — charges not yet assigned to a real project.
- tag_transaction (mcp:money:write) — assign a charge to a project; supports a partial split (remainder stays Personal).
- create_project (mcp:money:write) — add a project; re-creating an existing slug is a no-op success.
- project_pnl (mcp:money:read) — burn / income / net / MRR per project for a period.
- log_expense (mcp:money:write) — record a manual expense against a project.
- import_invoice (mcp:money:write) — parse a Stripe-shaped provider invoice (OpenAI/Anthropic/Cursor/Vercel/Supabase/Stripe) into per-line-item charges, optionally tag to a project, then reconcile against the paying card charge so it doesn't double-count.

The owner is fixed by the API key — you cannot read or write another founder's data.`

export function createMoneyMcpServer(ctx: MoneyToolCtx): McpServer {
  const server = new McpServer(
    { name: 'foundr-money', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )

  // Register a tool, wrapping its runner with audit-logging. The SDK infers the
  // callback arg type from the zod `inputSchema`; the runner declares the same
  // shape. We log status + latency on every call (success or throw) then
  // re-raise. The single `as unknown as ToolCallback<S>` cast bridges our
  // wrapper to the SDK's schema-derived callback type — the runners themselves
  // stay fully typed end-to-end.
  function register<S extends Record<string, z.ZodTypeAny>, A>(
    name: string,
    config: { title: string; description: string; inputSchema: S },
    run: (ctx: MoneyToolCtx, args: A) => Promise<ToolResult>,
  ): void {
    const wrapped = async (args: A): Promise<ToolResult> => {
      const start = Date.now()
      let status: 'ok' | 'error' = 'ok'
      try {
        const result = await run(ctx, args)
        if (result.isError) status = 'error'
        return result
      } catch (e) {
        status = 'error'
        throw e
      } finally {
        await auditLog({
          ownerId: ctx.ownerId,
          keyId: ctx.keyId,
          toolName: name,
          requestPayload: args as Record<string, unknown>,
          status,
          latencyMs: Date.now() - start,
        })
      }
    }
    server.registerTool(name, config, wrapped as unknown as ToolCallback<S>)
  }

  register(
    'list_untagged',
    {
      title: 'List untagged charges',
      description:
        'READ (scope mcp:money:read). Charges still sitting in Personal / Unallocated — i.e. not yet assigned to a real project. Call this first when the founder is reviewing spend; pass each returned id to tag_transaction.',
      inputSchema: listUntaggedInput,
    },
    runListUntagged,
  )

  register(
    'tag_transaction',
    {
      title: 'Tag a transaction to a project',
      description:
        'WRITE (scope mcp:money:write). Assign a charge (by id) to a project, by slug or id. Omit amount_cents to tag the full charge; pass a smaller same-sign amount_cents to split — the remainder stays in Personal / Unallocated.',
      inputSchema: tagTransactionInput,
    },
    runTagTransaction,
  )

  register(
    'create_project',
    {
      title: 'Create a project',
      description:
        'WRITE (scope mcp:money:write). Add a project to tag charges against. Re-creating a slug that already exists returns the existing project (DUPLICATE is success).',
      inputSchema: createProjectInput,
    },
    runCreateProject,
  )

  register(
    'project_pnl',
    {
      title: 'Project P&L',
      description:
        'READ (scope mcp:money:read). Burn / income / net / MRR for one project (slug or id) or the whole portfolio ("all"), over last30 | mtd | ytd | all.',
      inputSchema: projectPnlInput,
    },
    runProjectPnl,
  )

  register(
    'log_expense',
    {
      title: 'Log a manual expense',
      description:
        'WRITE (scope mcp:money:write). Record spend that never hit a connected account (cash, reimbursement) against a project. amount is positive dollars; unknown project falls back to Personal.',
      inputSchema: logExpenseInput,
    },
    runLogExpense,
  )

  register(
    'import_invoice',
    {
      title: 'Import a provider invoice',
      description:
        'WRITE (scope mcp:money:write). Parse a Stripe-shaped provider invoice JSON (OpenAI / Anthropic / Cursor / Vercel / Supabase / generic Stripe) into first-class per-line-item charges, write the provider_invoices record, optionally allocate the lines to a project (omit to leave untagged → Personal), then reconcile against the paying card charge so the invoice never double-counts. provider auto-detects from the invoice descriptor when omitted. No external credentials needed — the parser takes the already-parsed JSON.',
      inputSchema: importInvoiceInput,
    },
    runImportInvoice,
  )

  return server
}
