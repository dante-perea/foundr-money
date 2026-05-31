import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'

// Branded 404. Static — no auth/db. Rendered for any unmatched route.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Wordmark />
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
            404
          </p>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            This page wandered off.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted">
            The link is broken or the page never existed. Your numbers are right
            where you left them — let&rsquo;s get you back to them.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Back to home
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-accent transition hover:text-accent-hover"
            >
              Go to dashboard →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
