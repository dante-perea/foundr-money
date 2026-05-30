'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { CopyButton } from '@/components/connect/CopyButton'
import { CodeBlock } from '@/components/connect/CodeBlock'
import { mintMcpKey, type MintedKey } from '@/app/onboarding/actions'

type Editor = 'claude' | 'cursor'

function connectCommand(appUrl: string, token: string): string {
  return `claude mcp add --transport http foundr-money ${appUrl}/api/mcp/money --header "Authorization: Bearer ${token}"`
}

function cursorSnippet(appUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'foundr-money': {
          url: `${appUrl}/api/mcp/money`,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  )
}

/** Mask the full token for the on-screen reveal: keep the fm_ prefix + tail. */
function maskToken(token: string): string {
  if (token.length <= 12) return token
  return `${token.slice(0, 7)}…${token.slice(-4)}`
}

/**
 * (i) THE MOAT — tag spend from inside your editor. Mint a key (revealed once),
 * then a paste-and-run connect command with the FULL key substituted in (the
 * displayed wrap uses backslashes for readability; the copied string is the
 * single-line, fully-substituted command). The header chip flips to KEY READY.
 */
export function McpKeyCard({
  appUrl,
  exampleProject,
  minted,
  onMinted,
}: {
  appUrl: string
  /** First project name for the "tag $20 openai to my <X>" example. */
  exampleProject: string
  /** Once minted (lifted to parent so the recap can read it). */
  minted: MintedKey | null
  onMinted: (k: MintedKey) => void
}) {
  const [label, setLabel] = useState('')
  const [editor, setEditor] = useState<Editor>('claude')
  const [pending, startMint] = useTransition()
  const [error, setError] = useState(false)
  // Plaintext lives ONLY here, transient — never persisted, never in the recap.
  const [token, setToken] = useState<string | null>(null)

  function generate() {
    setError(false)
    startMint(async () => {
      try {
        const k = await mintMcpKey(label.trim() || undefined)
        setToken(k.plaintext)
        onMinted(k)
      } catch {
        setError(true)
      }
    })
  }

  const command =
    editor === 'claude'
      ? connectCommand(appUrl, token ?? 'fm_…')
      : cursorSnippet(appUrl, token ?? 'fm_…')

  return (
    <article className="rounded-md border border-accent/30 bg-surface p-6 transition">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">⌘ The moat</p>
        {minted && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            ✓ Key ready
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-lg font-medium text-ink">
        Tag spend from inside your editor
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        foundr.money speaks MCP. connect it once and tag, split, and reconcile transactions from
        inside Claude Code or Cursor — where you already are. mint a key, paste the command, done.
      </p>

      {!minted ? (
        <div className="mt-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
              label (optional)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="laptop · claude-code"
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 sm:text-sm"
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className={cn(
              'mt-3 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              pending && 'cursor-wait opacity-70',
            )}
          >
            {pending ? 'Generating…' : 'Generate my MCP key'}
          </button>
          <p className="mt-2 text-xs text-subtle">
            creates a personal key scoped to your projects. shown once.
          </p>
          {error && (
            <p className="mt-2 text-xs text-warning">couldn’t generate a key — retry.</p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* One-time key reveal */}
          {token && (
            <div className="rounded-md border border-accent/40 bg-accent/5 p-4">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-bg-alt px-3 py-2 font-mono text-sm text-ink">
                  {maskToken(token)}
                </code>
                <CopyButton value={token} label="Copy key" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-warning">
                this is the only time we’ll show the full key. copy it now. we keep a hash, never the
                raw value.
              </p>
              {/* a11y: announce that a key was generated, NEVER the secret itself */}
              <span aria-live="polite" className="sr-only">
                Key generated, copy it now
              </span>
            </div>
          )}

          {/* Editor tabs */}
          <div className="flex items-center gap-2">
            {(['claude', 'cursor'] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEditor(e)}
                aria-pressed={editor === e}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  editor === e
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-line bg-surface text-muted hover:border-line-strong',
                )}
              >
                {e === 'claude' ? 'Claude Code' : 'Cursor'}
              </button>
            ))}
          </div>

          <CodeBlock
            label={editor === 'claude' ? 'Claude Code' : 'Cursor · .cursor/mcp.json'}
            code={command}
          />

          <p className="text-sm text-muted">
            then, in any session:{' '}
            <span className="font-mono text-xs text-ink">
              “tag $20 openai to my {exampleProject}”
            </span>
          </p>

          {!token && (
            <p className="text-xs text-subtle">key generated · manage in settings.</p>
          )}
        </div>
      )}
    </article>
  )
}
