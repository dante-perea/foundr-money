import 'server-only'
import { db } from './db'
import { PROJECT_COLORS } from './constants'
import type { Project } from './types'

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project'
  )
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .eq('owner_id', ownerId)
    .order('is_personal', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function getProjectBySlug(ownerId: string, slug: string): Promise<Project | null> {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return (data as Project) ?? null
}

export async function ensurePersonalProject(ownerId: string): Promise<Project> {
  const { data } = await db()
    .from('projects')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_personal', true)
    .maybeSingle()
  if (data) return data as Project
  const { data: created, error } = await db()
    .from('projects')
    .insert({
      owner_id: ownerId,
      name: 'Personal / Unallocated',
      slug: 'personal',
      is_personal: true,
      color: '#94a3b8',
      description: 'Spend not yet assigned to a project.',
    })
    .select('*')
    .single()
  if (error) throw error
  return created as Project
}

export async function createProject(
  ownerId: string,
  input: { name: string; slug?: string; color?: string; description?: string },
): Promise<Project> {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name)
  // Dedup on (owner, slug) — DUPLICATE is success.
  const existing = await getProjectBySlug(ownerId, slug)
  if (existing) return existing
  const count = (await listProjects(ownerId)).filter((p) => !p.is_personal).length
  const color = input.color ?? PROJECT_COLORS[count % PROJECT_COLORS.length]
  const { data, error } = await db()
    .from('projects')
    .insert({
      owner_id: ownerId,
      name: input.name,
      slug,
      color,
      description: input.description ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Project
}
