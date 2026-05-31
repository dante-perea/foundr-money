import 'server-only'
import { db } from '../db'
import { createProject } from '../projects'

// ── Ecosystem project-map seed ─────────────────────────────────────────────
// The founder runs a 14-product foundr.* ecosystem on ONE Vercel team and a
// handful of Supabase projects. To turn raw provider spend into per-project
// burn we need a stable crosswalk: provider-native project id → foundr project.
//
// seedEcosystem(ownerId) is idempotent and does three things:
//   (a) createProject() one foundr project per product (dedups on slug), plus a
//       catch-all 'Unallocated / Platform' project for team-level charges
//       (the Pro fee, Speed Insights, Blob — Vercel rows with Tags == {}).
//   (b) upsert external_project_map rows (provider 'vercel') for every known
//       Vercel prj_ id. The 4 agentik-* deployments all fold into ONE 'agentik'
//       foundr project.
//   (c) ALSO hit the live Vercel + Supabase project lists to stay current —
//       refreshing the id↔name crosswalk and mapping the Supabase-backed
//       products by name (falling back to inlined refs when the name lookup
//       misses). All map writes upsert on the (owner_id, provider, external_id)
//       unique constraint, so re-runs are cheap no-ops.

// foundr project slug → display name. Order is the canonical product list.
const PRODUCTS: { name: string; slug: string }[] = [
  { name: 'foundr-world', slug: 'foundr-world' },
  { name: 'foundr-work', slug: 'foundr-work' },
  { name: 'foundr-host', slug: 'foundr-host' },
  { name: 'foundr-money', slug: 'foundr-money' },
  { name: 'foundr-company', slug: 'foundr-company' },
  { name: 'foundr-mobile', slug: 'foundr-mobile' },
  { name: 'foundr-agency', slug: 'foundr-agency' },
  { name: 'learn-spanish', slug: 'learn-spanish' },
  { name: 'tran-fashion-landing', slug: 'tran-fashion-landing' },
  { name: 'perea-ai', slug: 'perea-ai' },
  { name: 'agentik', slug: 'agentik' },
]

const UNALLOCATED = { name: 'Unallocated / Platform', slug: 'unallocated' }

// Vercel prj_ id → foundr project slug. The 4 agentik-* deployments collapse to
// the single 'agentik' project.
const VERCEL_MAP: Record<string, string> = {
  prj_cOl2uQDvDbhsQOAoAlfwSLIUD0v7: 'foundr-world',
  prj_NwmEnV0bXXHWDrE4duWttg23T4iA: 'foundr-work',
  prj_B6T4H0iznmQEM0wXD5FeLeQw1XRG: 'foundr-host',
  prj_ERZsGL36wxHu77m57lFO5FpEvkEn: 'foundr-money',
  prj_FSgOeHEWmY5JO4y7U5SRGqjpsa5Z: 'foundr-company',
  prj_t8h8vShBptMxXA5WxVRpMs0Fznvl: 'foundr-mobile',
  prj_uFtq81kSPeZHlXmMW1SqqyomvjIy: 'foundr-agency',
  prj_yKp4E7OQhFWnSf4iaim0Z1vY2CRo: 'learn-spanish',
  prj_8rS0OgSdA2ZIhbhFsqqM78xfhXeH: 'tran-fashion-landing',
  prj_7MRrShXX0I7G3E7V1D3t1M5x5RVC: 'perea-ai',
  // 4 agentik-* deployments → ONE agentik project
  prj_mv2IWOFq: 'agentik',
  prj_N1dbYR9d: 'agentik',
  prj_MZdOanlr: 'agentik',
  prj_rLriug53: 'agentik',
}

// Supabase project name → foundr project slug (matched against the live
// /v1/projects list). Inlined refs are the fallback when the name match misses.
const SUPABASE_NAME_MAP: Record<string, string> = {
  'perea-now-games': 'foundr-world',
  'foundr-world-lab': 'foundr-world',
  'perea-brain': 'perea-ai',
  'foundr-mobile': 'foundr-mobile',
  'foundr-host': 'foundr-host',
  'foundr-money': 'foundr-money',
}

// Fallback Supabase refs keyed by the same name — used only when the live list
// fetch fails or a name isn't present. ref ↔ foundr slug.
const SUPABASE_FALLBACK_REFS: { ref: string; slug: string }[] = [
  { ref: 'hnxhrexbsowblinluuii', slug: 'foundr-world' }, // perea-now-games (prod)
  { ref: 'pxmqbsxwvylgfyqbxstl', slug: 'foundr-world' }, // foundr-world-lab
]

export interface EcosystemSeedResult {
  projectsCreated: number
  mapped: number
}

type VercelProject = { id: string; name: string }
type SupabaseProject = { id?: string; ref?: string; name: string }

/** Fetch the live Vercel project crosswalk (id ↔ name). Never throws. */
async function fetchVercelProjects(): Promise<VercelProject[]> {
  const token = process.env.VERCEL_TOKEN
  if (!token) return []
  try {
    const url = new URL('https://api.vercel.com/v9/projects')
    if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID)
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!resp.ok) return []
    const body = (await resp.json()) as { projects?: VercelProject[] }
    return Array.isArray(body.projects) ? body.projects : []
  } catch {
    return []
  }
}

/** Fetch the live Supabase project list (ref ↔ name). Never throws. */
async function fetchSupabaseProjects(): Promise<SupabaseProject[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return []
  try {
    const resp = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return []
    const body = (await resp.json()) as SupabaseProject[]
    return Array.isArray(body) ? body : []
  } catch {
    return []
  }
}

/**
 * Seed the foundr.* ecosystem: create one project per product (+ an Unallocated
 * / Platform catch-all), then upsert the external_project_map crosswalk for
 * Vercel (every prj_) and Supabase (the 6 backed products). Idempotent.
 */
export async function seedEcosystem(ownerId: string): Promise<EcosystemSeedResult> {
  // (a) Create one foundr project per product + the Unallocated catch-all.
  // createProject dedups on slug, so re-runs return the existing row.
  const slugToProjectId: Record<string, string> = {}
  let projectsCreated = 0
  for (const p of [...PRODUCTS, UNALLOCATED]) {
    const project = await createProject(ownerId, { name: p.name, slug: p.slug })
    slugToProjectId[p.slug] = project.id
    projectsCreated++
  }

  // Collect every map upsert, then write in one batch (upsert on the unique
  // (owner_id, provider, external_id) constraint → idempotent).
  const rows: { owner_id: string; provider: 'vercel' | 'supabase'; external_id: string; project_id: string }[] = []

  // (b) Vercel prj_ → foundr project. Inlined MAPPING is authoritative.
  for (const [externalId, slug] of Object.entries(VERCEL_MAP)) {
    const projectId = slugToProjectId[slug]
    if (!projectId) continue
    rows.push({ owner_id: ownerId, provider: 'vercel', external_id: externalId, project_id: projectId })
  }

  // (c) Live crosswalk — refresh Vercel + Supabase to stay current.
  // Vercel: fold any live project whose name matches a known slug into its
  // foundr project (covers ids not in the inlined MAPPING, e.g. new deploys).
  const liveVercel = await fetchVercelProjects()
  const knownVercelIds = new Set(Object.keys(VERCEL_MAP))
  for (const vp of liveVercel) {
    if (!vp.id || !vp.name || knownVercelIds.has(vp.id)) continue
    const slug = slugForVercelName(vp.name)
    const projectId = slug ? slugToProjectId[slug] : undefined
    if (!projectId) continue
    rows.push({ owner_id: ownerId, provider: 'vercel', external_id: vp.id, project_id: projectId })
  }

  // Supabase: map the backed products by live name, fall back to inlined refs.
  const liveSupabase = await fetchSupabaseProjects()
  const matchedSlugs = new Set<string>()
  for (const sp of liveSupabase) {
    const ref = sp.ref ?? sp.id
    if (!ref || !sp.name) continue
    const slug = SUPABASE_NAME_MAP[sp.name]
    if (!slug) continue
    const projectId = slugToProjectId[slug]
    if (!projectId) continue
    rows.push({ owner_id: ownerId, provider: 'supabase', external_id: ref, project_id: projectId })
    matchedSlugs.add(`${sp.name}:${ref}`)
  }
  // Fallback refs for the products the live list didn't surface.
  const liveRefs = new Set(liveSupabase.map((sp) => sp.ref ?? sp.id).filter(Boolean) as string[])
  for (const fb of SUPABASE_FALLBACK_REFS) {
    if (liveRefs.has(fb.ref)) continue
    const projectId = slugToProjectId[fb.slug]
    if (!projectId) continue
    rows.push({ owner_id: ownerId, provider: 'supabase', external_id: fb.ref, project_id: projectId })
  }

  // De-dup rows by (provider, external_id) before the batch upsert so a single
  // ref can't appear twice in one statement.
  const seen = new Set<string>()
  const deduped = rows.filter((r) => {
    const key = `${r.provider}:${r.external_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let mapped = 0
  if (deduped.length > 0) {
    const { error } = await db()
      .from('external_project_map')
      .upsert(deduped, { onConflict: 'owner_id,provider,external_id' })
    if (error) throw error
    mapped = deduped.length
  }

  return { projectsCreated, mapped }
}

/** Map a live Vercel project NAME to a foundr slug (covers agentik-* prefixes). */
function slugForVercelName(name: string): string | null {
  const n = name.toLowerCase()
  if (n.startsWith('agentik')) return 'agentik'
  // Exact match against a known product slug.
  if (PRODUCTS.some((p) => p.slug === n)) return n
  return null
}
