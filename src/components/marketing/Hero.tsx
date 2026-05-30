import Link from 'next/link'
import { PRODUCT } from '@/lib/money/constants'

// Hero — eyebrow, the product tagline as H1, the one-liner as subhead, and the
// primary / secondary CTAs. All copy comes from the PRODUCT constant so the
// marketing voice stays in one place.
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface">
      {/* faint hairline grid behind the hero — restraint, no glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:64px_64px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_30%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
            agent-first budgeting
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {PRODUCT.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {PRODUCT.oneLiner}
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Get started
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:border-line-strong"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs text-subtle">
            no entity required · no card to apply for · live in three steps
          </p>
        </div>
      </div>
    </section>
  )
}
