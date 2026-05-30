// src/lib/mcp/tools/create-project.ts
//
// WRITE tool — spin up a new project to tag charges against. DUPLICATE (a
// project with the same slug already exists) is treated as success.
import 'server-only'
import { z } from 'zod'
import { createProject, getProjectBySlug, slugify } from '@/lib/money/projects'
import { requireScope } from '../auth'
import { MCP_SCOPES } from '@/lib/money/constants'
import { text, type MoneyToolCtx, type ToolResult } from './_shared'

export const createProjectInput = {
  name: z.string().min(1).describe('Human-readable project name, e.g. "Acme SaaS"'),
  slug: z.string().optional().describe('URL slug; derived from the name if omitted'),
  color: z.string().optional().describe('Hex chart color (#rrggbb); auto-assigned if omitted'),
}

export async function runCreateProject(
  ctx: MoneyToolCtx,
  args: { name: string; slug?: string; color?: string },
): Promise<ToolResult> {
  requireScope(ctx.scopes, MCP_SCOPES.write)

  const wantSlug = args.slug ? slugify(args.slug) : slugify(args.name)
  const already = await getProjectBySlug(ctx.ownerId, wantSlug)

  const project = await createProject(ctx.ownerId, {
    name: args.name,
    slug: args.slug,
    color: args.color,
  })

  const verb = already ? 'Project already exists' : 'Created project'
  return text(`${verb}: ${project.name} (slug: ${project.slug}).`, {
    project_id: project.id,
    name: project.name,
    slug: project.slug,
    color: project.color,
    already_existed: Boolean(already),
  })
}
