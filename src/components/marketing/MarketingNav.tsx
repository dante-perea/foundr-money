import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'

// Public marketing nav — Wordmark + Pricing / Sign in links + "Get started".
// No Clerk session hooks: always shows the signed-out CTAs so the page stays
// statically prerenderable.
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <div className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/pricing"
            className="hidden text-sm font-medium text-muted transition hover:text-ink sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted transition hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}
