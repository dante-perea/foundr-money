import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { PricingCards } from '@/components/marketing/PricingCards'
import { Section } from '@/components/marketing/Section'

export const metadata: Metadata = {
  title: 'Pricing — foundr.money',
  description:
    'One personal card, five projects, one subscription — versus roughly $575/mo and five incorporations on QuickBooks. Plans start at $19/mo.',
}

// Static, prerenderable pricing page. No Clerk session hooks.
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <MarketingNav />
      <main>
        {/* Header + the killer comparison line */}
        <section className="bg-surface pb-4 pt-20 sm:pt-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
                pricing
              </p>
              <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                Priced for one founder, not a finance team.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
                One personal card, five projects, one subscription — versus
                roughly{' '}
                <span className="font-medium text-ink tabular">$575/mo</span> and
                five incorporations on QuickBooks.
              </p>
            </div>
          </div>
        </section>

        {/* The two plans */}
        <Section className="pt-10">
          <div className="mx-auto max-w-4xl">
            <PricingCards />
            <p className="mt-6 text-center font-mono text-xs text-subtle">
              agentic tagging in Claude Code &amp; Cursor is free on both plans ·
              cancel anytime
            </p>
          </div>
        </Section>

        {/* Comparison band — why the cheap plan wins */}
        <Section tone="alt">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
              the math
            </p>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Per-project P&amp;L without the five LLCs.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              QuickBooks only does per-project profitability at the Plus tier —
              and bills one subscription per legal entity. Five projects means
              five incorporations and roughly{' '}
              <span className="font-medium text-ink tabular">$575/mo</span>.
              Unincorporated projects are impossible at any price. foundr.money
              does the whole portfolio on one personal card, starting at{' '}
              <span className="font-medium text-ink tabular">$19/mo</span>.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                Get started
              </Link>
              <Link
                href="/"
                className="text-sm font-medium text-accent transition hover:text-accent-hover"
              >
                Back to overview →
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  )
}
