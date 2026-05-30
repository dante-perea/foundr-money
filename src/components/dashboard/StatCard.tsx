import Link from 'next/link'
import { cn } from '@/lib/cn'

/** A headline stat: mono eyebrow label, big tabular figure, optional caption.
 *  When `href` is set the whole card becomes a link with a hairline hover. */
export function StatCard({
  label,
  value,
  caption,
  valueClassName,
  href,
}: {
  label: string
  value: string
  caption?: React.ReactNode
  valueClassName?: string
  href?: string
}) {
  const inner = (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">{label}</p>
      <p className={cn('mt-3 font-display text-3xl font-semibold tracking-tight tabular text-ink', valueClassName)}>
        {value}
      </p>
      {caption ? <p className="mt-2 text-sm text-muted">{caption}</p> : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">
        {inner}
      </Link>
    )
  }
  return <div className="rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">{inner}</div>
}
