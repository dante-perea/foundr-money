import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/money/owner'
import { ensurePersonalProject } from '@/lib/money/projects'
import { isOnboarded } from '@/lib/money/onboarding'
import {
  CLERK_IS_SATELLITE,
  CLERK_SATELLITE_DOMAIN,
  SIGN_IN_URL,
} from '@/lib/clerk-satellite'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const ownerId = await getOwnerId()
  if (!ownerId) {
    redirect(
      CLERK_IS_SATELLITE
        ? `${SIGN_IN_URL}?redirect_url=${encodeURIComponent(`https://${CLERK_SATELLITE_DOMAIN}/onboarding`)}`
        : '/sign-in',
    )
  }
  await ensurePersonalProject(ownerId)
  // Already onboarded → straight to the dashboard.
  if (await isOnboarded(ownerId)) redirect('/dashboard')

  return (
    // ClerkProvider is root-mounted (src/app/layout.tsx) — no per-route wrapper.
    <div className="min-h-screen bg-bg-alt">{children}</div>
  )
}
