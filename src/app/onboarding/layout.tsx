import { redirect } from 'next/navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { getOwnerId } from '@/lib/money/owner'
import { ensurePersonalProject } from '@/lib/money/projects'
import { isOnboarded } from '@/lib/money/onboarding'
import {
  clerkProviderProps,
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
    <ClerkProvider {...clerkProviderProps} afterSignOutUrl="/">
      <div className="min-h-screen bg-bg-alt">{children}</div>
    </ClerkProvider>
  )
}
