import Link from 'next/link'
import { AuthRedirectLink } from '@/components/auth/AuthRedirectLink'
import { Wordmark } from '@/components/brand/Wordmark'

// Marketing footer — wordmark, a few links, and the canonical Perea byline.
export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/pricing" className="transition hover:text-ink">
            Pricing
          </Link>
          <AuthRedirectLink mode="sign-in" className="transition hover:text-ink">
            Sign in
          </AuthRedirectLink>
          <AuthRedirectLink mode="sign-up" className="transition hover:text-ink">
            Get started
          </AuthRedirectLink>
          <Link href="/privacy" className="transition hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-ink">
            Terms
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-6 py-5 font-mono text-xs text-subtle">
          Foundr — tools for the AI-native solo founder · © 2026 Perea
        </p>
      </div>
    </footer>
  )
}
