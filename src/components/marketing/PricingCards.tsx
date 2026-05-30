import Link from 'next/link'
import { cn } from '@/lib/cn'
import { PRICING } from '@/lib/money/constants'

const PLANS = [
  { ...PRICING.solo, featured: false },
  { ...PRICING.pro, featured: true },
] as const

function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
    >
      <path
        d="M13 4.5 6.5 11 3 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// The two pricing cards rendered from the PRICING constant. Shared by /pricing
// and (optionally) the landing teaser.
export function PricingCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            'flex flex-col rounded-md border bg-surface p-7 transition',
            plan.featured
              ? 'border-accent shadow-sm'
              : 'border-line hover:border-line-strong hover:shadow-sm',
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">
              {plan.name}
            </h3>
            {plan.featured ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                most popular
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {plan.tagline}
          </p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="font-display text-4xl font-semibold tracking-tight text-ink tabular">
              ${plan.price}
            </span>
            <span className="font-mono text-sm text-subtle">{plan.cadence}</span>
          </p>
          <ul className="mt-7 flex flex-1 flex-col gap-3 border-t border-line pt-7">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-3 text-sm leading-relaxed text-ink">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className={cn(
              'mt-8 rounded-md px-5 py-2.5 text-center text-sm font-medium transition',
              plan.featured
                ? 'bg-accent text-white hover:bg-accent-hover'
                : 'border border-line bg-surface text-ink hover:border-line-strong',
            )}
          >
            Get started
          </Link>
        </div>
      ))}
    </div>
  )
}
