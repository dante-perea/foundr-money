'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

/** A small copy-to-clipboard button with a transient "Copied" confirmation. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked (insecure context / permissions) — fail silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs font-medium text-ink transition hover:border-line-strong',
        className,
      )}
    >
      <span aria-hidden className="text-subtle">
        {copied ? '✓' : '⧉'}
      </span>
      {copied ? 'Copied' : label}
    </button>
  )
}
