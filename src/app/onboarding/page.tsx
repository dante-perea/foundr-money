import { Suspense } from 'react'
import { requireOwnerId } from '@/lib/money/owner'
import { listProjects } from '@/lib/money/projects'
import { plaidConfigured } from '@/lib/money/ingest/plaid'
import { db } from '@/lib/money/db'
import { OnboardingFlow, type InitialProject } from './onboarding-client'
import { OnboardingChromeFallback } from '@/components/onboarding/OnboardingChromeFallback'

export const metadata = {
  title: 'Set up · foundr.money',
}

/** Cheap, owner-scoped check: does this workspace already hold real spend?
 *  Used to hide the "explore with sample data" fork so we never offer to
 *  pollute an account that has real transactions. */
async function hasTransactions(owner: string): Promise<boolean> {
  const { count } = await db()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', owner)
  return (count ?? 0) > 0
}

/**
 * Dynamic data island. `requireOwnerId()` awaits connection() + auth() — that
 * marks this child dynamic while the surrounding shell can prerender (PPR).
 * Auth + redirect-if-onboarded + ensurePersonalProject already happen in the
 * route layout, so here we only load what the wizard needs to hydrate.
 */
async function OnboardingData() {
  const owner = await requireOwnerId()
  const [all, hasTxns] = await Promise.all([listProjects(owner), hasTransactions(owner)])

  const projects: InitialProject[] = all
    .filter((p) => !p.is_personal && p.status !== 'archived')
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug, color: p.color }))

  return (
    <OnboardingFlow
      initialProjects={projects}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
      plaidConfigured={plaidConfigured()}
      hasRealData={hasTxns}
    />
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingChromeFallback />}>
      <OnboardingData />
    </Suspense>
  )
}
