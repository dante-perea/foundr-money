import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClerkProvider, UserButton } from '@clerk/nextjs'
import { getOwnerId } from '@/lib/money/owner'
import { ensureSeeded } from '@/lib/money/seed'
import { Wordmark } from '@/components/brand/Wordmark'
import {
  clerkProviderProps,
  CLERK_IS_SATELLITE,
  CLERK_SATELLITE_DOMAIN,
  SIGN_IN_URL,
} from '@/lib/clerk-satellite'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ownerId = await getOwnerId()
  if (!ownerId) {
    // Satellite: bounce to the primary (foundr.company) sign-in and return here.
    redirect(
      CLERK_IS_SATELLITE
        ? `${SIGN_IN_URL}?redirect_url=${encodeURIComponent(`https://${CLERK_SATELLITE_DOMAIN}/dashboard`)}`
        : '/sign-in',
    )
  }
  // First visit: lazily provision a believable demo so the product is alive.
  await ensureSeeded(ownerId)

  return (
    <ClerkProvider {...clerkProviderProps} afterSignOutUrl="/">
    <div className="min-h-screen bg-bg-alt">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Wordmark href="/dashboard" />
            <nav className="hidden items-center gap-6 text-sm sm:flex">
              <Link href="/dashboard" className="text-muted transition hover:text-ink">
                Overview
              </Link>
              <Link href="/dashboard/transactions" className="text-muted transition hover:text-ink">
                Transactions
              </Link>
              <Link href="/dashboard/connect" className="text-muted transition hover:text-ink">
                Connect
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
    </ClerkProvider>
  )
}
