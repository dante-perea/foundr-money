import { cn } from '@/lib/cn'

// A full-bleed section band with the standard py-20 rhythm and a centered
// max-w-6xl container. `tone="alt"` paints the slate-50 band; default is white.
export function Section({
  children,
  tone = 'default',
  className,
  id,
}: {
  children: React.ReactNode
  tone?: 'default' | 'alt'
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn('py-20', tone === 'alt' ? 'bg-bg-alt' : 'bg-surface', className)}
    >
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  )
}

// Mono eyebrow label that sits above a section heading.
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
      {children}
    </p>
  )
}

// Section heading block: eyebrow → H2 → optional lede.
export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow ? (
        <>
          <Eyebrow>{eyebrow}</Eyebrow>
          <div className="h-3" />
        </>
      ) : null}
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-base leading-relaxed text-muted">{lede}</p>
      ) : null}
    </div>
  )
}

// The brand card: hairline border, no resting shadow, lifts to a strong border
// + faint shadow on hover.
export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface p-6 transition hover:border-line-strong hover:shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
