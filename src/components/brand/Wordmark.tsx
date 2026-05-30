import Link from 'next/link'
import { cn } from '@/lib/cn'

// foundr.money wordmark. The accent dot + accent TLD are reserved for THIS
// product; on cross-links to other foundr.* tools the TLD is muted.
export function Wordmark({
  href = '/',
  className,
  accent = true,
}: {
  href?: string
  className?: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2 font-display text-base font-semibold text-ink', className)}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', accent ? 'bg-accent' : 'bg-subtle')} aria-hidden />
      <span>
        foundr<span className={accent ? 'text-accent' : 'text-subtle'}>.money</span>
      </span>
    </Link>
  )
}
