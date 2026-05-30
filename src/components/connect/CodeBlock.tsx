'use client'

import { CopyButton } from './CopyButton'

/**
 * A monospaced, copy-paste-ready code block with a header label and a copy
 * button wired to the raw text. Used for the MCP connect command and the
 * Cursor mcp.json snippet.
 */
export function CodeBlock({
  label,
  code,
  copyValue,
}: {
  label: string
  code: string
  /** What lands on the clipboard (defaults to the displayed code). */
  copyValue?: string
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-bg-alt">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">{label}</span>
        <CopyButton value={copyValue ?? code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-xs leading-relaxed text-ink">
        <code className="font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}
