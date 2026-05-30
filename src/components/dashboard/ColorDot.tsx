import { cn } from '@/lib/cn'

/** A small project color swatch. Sizes track text scale. */
export function ColorDot({
  color,
  size = 'sm',
  className,
}: {
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim = size === 'lg' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 rounded-full', dim, className)}
      style={{ backgroundColor: color }}
    />
  )
}
