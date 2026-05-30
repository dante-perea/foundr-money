import Link from 'next/link'
import { Section } from './Section'
import { PRICING } from '@/lib/money/constants'

// Compact pricing teaser on the landing page — anchors the price, lands the
// killer comparison line, and links out to the full /pricing page.
export function PricingTeaser() {
  return (
    <Section>
      <div className="mx-auto max-w-3xl rounded-md border border-line bg-bg-alt p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
          pricing
        </p>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          One card, five projects, one subscription.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          Starts at{' '}
          <span className="font-medium text-ink tabular">
            ${PRICING.solo.price}
            {PRICING.solo.cadence}
          </span>
          . Versus roughly{' '}
          <span className="font-medium text-ink tabular">$575/mo</span> and five
          incorporations to get the same per-project view out of QuickBooks.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            See pricing
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-medium text-accent transition hover:text-accent-hover"
          >
            Get started →
          </Link>
        </div>
      </div>
    </Section>
  )
}
