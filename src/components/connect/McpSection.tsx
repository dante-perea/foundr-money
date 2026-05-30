'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { CopyButton } from './CopyButton'
import { CodeBlock } from './CodeBlock'
import { mintKeyAction, revokeKeyAction } from '@/app/dashboard/connect/actions'

export interface AgentKeyView {
  id: string
  label: string
  status: string
  last_used_at: string | null
  created_at: string
}

const TOKEN_PLACEHOLDER = 'fm_…'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

/**
 * THE moat. Agent tagging over MCP. Lists existing keys, mints a new bearer
 * (revealed exactly once), and shows copy-paste-ready connect snippets for
 * Claude Code and Cursor.
 */
export function McpSection({
  appUrl,
  initialKeys,
}: {
  appUrl: string
  initialKeys: AgentKeyView[]
}) {
  const router = useRouter()
  const [keys, setKeys] = useState<AgentKeyView[]>(initialKeys)
  const [label, setLabel] = useState('')
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [minting, startMint] = useTransition()
  const [revoking, setRevoking] = useState<string | null>(null)

  // The snippets show the freshly-minted token if present, else a placeholder
  // so the shape is always legible before the founder has a key.
  const tokenForSnippets = freshToken ?? TOKEN_PLACEHOLDER

  function generate() {
    startMint(async () => {
      const trimmed = label.trim()
      const { token, id } = await mintKeyAction(trimmed || undefined)
      setFreshToken(token)
      setKeys((prev) => [
        {
          id,
          label: trimmed || 'default',
          status: 'active',
          last_used_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setLabel('')
      router.refresh()
    })
  }

  async function revoke(id: string) {
    setRevoking(id)
    try {
      await revokeKeyAction(id)
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: 'revoked' } : k)))
      router.refresh()
    } finally {
      setRevoking(null)
    }
  }

  return (
    <section className="rounded-md border border-accent/30 bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">The moat</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Tag spend from inside your editor.
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted">
          foundr.money speaks MCP. Connect it once and tag, split, and reconcile transactions from
          inside Claude Code or Cursor — where you already are. Mint a key, paste the command, done.
        </p>
      </div>

      {/* Generate key */}
      <div className="mt-6 rounded-md border border-line bg-bg-alt p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
              Key label (optional)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. laptop · claude-code"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={minting}
            className={cn(
              'rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
              minting && 'cursor-wait opacity-70',
            )}
          >
            {minting ? 'Generating…' : 'Generate key'}
          </button>
        </div>

        {/* One-time reveal */}
        {freshToken && (
          <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                  New key — copy it now
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  This is the only time you&apos;ll see this token. Store it somewhere safe. We keep a
                  hash, never the raw value.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFreshToken(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-1 text-subtle transition hover:text-ink"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
                {freshToken}
              </code>
              <CopyButton value={freshToken} label="Copy token" />
            </div>
          </div>
        )}
      </div>

      {/* Connect snippets */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CodeBlock
          label="Claude Code"
          code={connectCommand(appUrl, tokenForSnippets)}
          copyValue={connectCommand(appUrl, freshToken ?? TOKEN_PLACEHOLDER)}
        />
        <CodeBlock label="Cursor · .cursor/mcp.json" code={cursorSnippet(appUrl, tokenForSnippets)} />
      </div>
      {!freshToken && (
        <p className="mt-2 text-xs text-subtle">
          Generate a key above and the <span className="font-mono">fm_…</span> placeholder fills in
          automatically.
        </p>
      )}

      {/* Existing keys */}
      <div className="mt-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Your keys</p>
        {keys.length === 0 ? (
          <p className="mt-3 rounded-md border border-line bg-bg-alt px-4 py-3 text-sm text-muted">
            No keys yet. Generate one to connect an agent.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line">
            {keys.map((k) => {
              const revoked = k.status !== 'active'
              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm font-medium',
                          revoked ? 'text-subtle line-through' : 'text-ink',
                        )}
                      >
                        {k.label}
                      </span>
                      {revoked && (
                        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                          revoked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-subtle">
                      created {fmtDate(k.created_at)} · last used {fmtDate(k.last_used_at)}
                    </p>
                  </div>
                  {!revoked && (
                    <button
                      type="button"
                      onClick={() => revoke(k.id)}
                      disabled={revoking === k.id}
                      className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-line-strong disabled:opacity-60"
                    >
                      {revoking === k.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
