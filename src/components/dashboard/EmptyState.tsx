import Link from 'next/link'
import { cn } from '@/lib/cn'

type CtaAction = {
  /** Button label. */
  label: string
  /** Internal route the button navigates to. */
  href: string
}

/**
 * A reusable, brand-native empty state.
 *
 * Reads as intentional, not broken: a hairline card with a glyph badge, mono
 * eyebrow, display title, a single line of muted copy, and one (optionally two)
 * clear CTAs. Single accent, no gradients/glows, no resting shadow — matches the
 * StatCard / connect-card vocabulary already used across the dashboard.
 *
 * Use for a freshly-onboarded account that has no spend / no transactions yet,
 * so the empty surface still feels like the product.
 */
export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  primary,
  secondary,
  className,
}: {
  /** A short glyph or emoji shown in the badge (e.g. '＄', '⌘'). */
  icon: React.ReactNode
  /** Mono uppercase eyebrow, e.g. 'NO SPEND YET'. */
  eyebrow: string
  /** Display headline — one short, confident line. */
  title: string
  /** A single line of muted supporting copy. */
  description: React.ReactNode
  /** The one obvious next step. */
  primary: CtaAction
  /** Optional quieter alternative. */
  secondary?: CtaAction
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-md border border-line bg-surface px-6 py-14 text-center transition hover:border-line-strong sm:py-16',
        className,
      )}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-md border border-line bg-bg-alt font-display text-xl text-accent"
        aria-hidden
      >
        {icon}
      </span>

      <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-subtle">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted">{description}</p>

      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href={primary.href}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          {primary.label}
        </Link>
        {secondary ? (
          <Link
            href={secondary.href}
            className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:border-line-strong"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
