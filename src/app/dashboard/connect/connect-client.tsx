'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AccountProvider } from '@/lib/money/types'
import { McpSection, type AgentKeyView } from '@/components/connect/McpSection'
import { PlaidConnectButton } from '@/components/connect/PlaidConnectButton'
import { ProviderCard, PROVIDERS } from '@/components/connect/ProviderCard'
import { ExportSection } from '@/components/connect/ExportSection'
import { syncEcosystemAction, type SyncEcosystemResult } from './actions'

export interface ConnectedAccountView {
  id: string
  provider: AccountProvider
  display_name: string
  last4: string | null
}

const PROVIDER_LABEL: Record<string, string> = {
  plaid: 'Bank / card',
  stripe: 'Stripe',
  manual: 'Manual',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  vercel: 'Vercel',
  supabase: 'Supabase',
  cursor: 'Cursor',
}

export function ConnectClient({
  keys,
  accounts,
  appUrl,
}: {
  keys: AgentKeyView[]
  accounts: ConnectedAccountView[]
  appUrl: string
}) {
  // Group connected accounts by provider so each provider card can show its own.
  const byProvider = new Map<AccountProvider, ConnectedAccountView[]>()
  for (const a of accounts) {
    const list = byProvider.get(a.provider) ?? []
    list.push(a)
    byProvider.set(a.provider, list)
  }

  return (
    <div className="flex flex-col gap-12">
      {/* Page header */}
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Connect</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Wire up every money source.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Banks, cards, Stripe, and the AI bills that quietly run your projects — all on one ledger,
          all taggable by an agent.
        </p>
      </header>

      {/* (A) MCP — the moat, first */}
      <McpSection appUrl={appUrl} initialKeys={keys} />

      {/* (B) Connect a bank */}
      <section className="rounded-md border border-line bg-surface p-6 sm:p-8 transition hover:border-line-strong">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Banks & cards</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          One card, every project.
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Link the personal card you actually pay for everything on. foundr.money pulls the
          transactions and lets you split each one across the projects it really belongs to.
        </p>
        <div className="mt-5">
          <PlaidConnectButton />
        </div>
      </section>

      {/* (C) Provider connections */}
      <section className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">AI & cloud</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            Bills that already know the project.
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            OpenAI, Anthropic, and Vercel tag spend by their own native project id. Pair it to a
            foundr project once and the line items sort themselves forever.
          </p>
        </div>
        <EcosystemSyncSection />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((spec) => (
            <ProviderCard
              key={spec.provider}
              spec={spec}
              accounts={(byProvider.get(spec.provider) ?? []).map((a) => ({
                display_name: a.display_name,
                last4: a.last4,
              }))}
            />
          ))}
        </div>
      </section>

      {/* (D) Connected accounts */}
      <section className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Connected</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            What&apos;s feeding the ledger.
          </h2>
        </div>
        {accounts.length === 0 ? (
          <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
            No accounts connected yet. Link a bank or pair a provider above.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-bg-alt font-display text-xs font-semibold text-ink"
                  >
                    {a.display_name.charAt(0)}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">{a.display_name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {a.last4 ? (
                    <span className="tabular font-mono text-xs text-subtle">•••• {a.last4}</span>
                  ) : null}
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                    {PROVIDER_LABEL[a.provider] ?? a.provider}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tax-aware export */}
      <ExportSection />
    </div>
  )
}

/**
 * One-tap sync for the whole foundr.* ecosystem: ensures every project exists +
 * is mapped to its Vercel project id, pulls the real Vercel FOCUS billing
 * export, ingests it per-project, and reconciles invoices to card charges.
 * Optimistic-by-nature: the action returns a summary; on success we
 * router.refresh() to reconcile the server-rendered lists. No revalidateTag.
 */
function EcosystemSyncSection() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncEcosystemResult | null>(null)

  function onSync() {
    setResult(null)
    startTransition(async () => {
      const res = await syncEcosystemAction()
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight text-ink">
            Sync ecosystem spend
          </p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
            Pull this month&apos;s real Vercel usage across all 14 products, map each line item to
            its foundr project, and reconcile the invoices to your card.
          </p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? 'Syncing…' : 'Sync ecosystem spend'}
        </button>
      </div>

      {result ? (
        result.ok ? (
          <p className="mt-4 rounded-md border border-line bg-bg-alt px-4 py-3 text-sm text-ink">
            Synced.{' '}
            <span className="font-mono text-subtle">
              {result.projectsCreated} {result.projectsCreated === 1 ? 'project' : 'projects'} mapped
              {' · '}
              {result.ingested} {result.ingested === 1 ? 'line item' : 'line items'} ingested
            </span>
          </p>
        ) : (
          <div className="mt-4 rounded-md border border-line bg-bg-alt px-4 py-3 text-sm text-ink">
            <p>
              Synced with issues.{' '}
              <span className="font-mono text-subtle">
                {result.projectsCreated} mapped · {result.ingested} ingested
              </span>
            </p>
            {result.errors.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs text-subtle">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}
