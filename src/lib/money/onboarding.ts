import 'server-only'
import { db } from './db'

export interface OnboardingState {
  owner_id: string
  completed_at: string | null
  used_sample_data: boolean
}

export async function getOnboarding(ownerId: string): Promise<OnboardingState | null> {
  const { data } = await db().from('onboarding').select('*').eq('owner_id', ownerId).maybeSingle()
  return (data as OnboardingState) ?? null
}

export async function isOnboarded(ownerId: string): Promise<boolean> {
  const row = await getOnboarding(ownerId)
  return Boolean(row?.completed_at)
}

/** Mark onboarding complete (idempotent). usedSampleData distinguishes the
 *  "explore with sample data" path from a real setup. */
export async function markOnboarded(
  ownerId: string,
  opts: { usedSampleData?: boolean } = {},
): Promise<void> {
  await db()
    .from('onboarding')
    .upsert(
      {
        owner_id: ownerId,
        completed_at: new Date().toISOString(),
        used_sample_data: opts.usedSampleData ?? false,
      },
      { onConflict: 'owner_id' },
    )
}
