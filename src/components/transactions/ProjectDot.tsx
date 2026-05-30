'use client'

/** A small colored dot identifying a project. */
export function ProjectDot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}
