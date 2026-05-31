'use client'

import { useCallback, useId, useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { disconnectAccountAction, deleteAllDataAction } from './actions'

export interface AccountView {
  id: string
  provider: string
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

const CONFIRM_PHRASE = 'delete'

export function SettingsClient({ accounts }: { accounts: AccountView[] }) {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Settings</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          your account, your data.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Manage what&apos;s feeding the ledger, your agent access, and — if you ever need it — the
          door out. Deleting your data is permanent and only ever touches your account.
        </p>
      </header>

      <ConnectedAccountsSection accounts={accounts} />
      <AgentKeysSection />
      <DangerZone />
    </div>
  )
}

function ConnectedAccountsSection({ accounts }: { accounts: AccountView[] }) {
  const [, startTransition] = useTransition()
  // Track ids the user has removed so they vanish instantly. Reconciles on reload.
  const [removed, optimisticallyRemove] = useOptimistic<string[], string>(
    [],
    (state, id) => [...state, id],
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(
    () => accounts.filter((a) => !removed.includes(a.id)),
    [accounts, removed],
  )

  const handleDisconnect = useCallback(
    (id: string) => {
      setError(null)
      setPendingId(id)
      startTransition(async () => {
        optimisticallyRemove(id)
        try {
          await disconnectAccountAction(id)
        } catch {
          setError('Could not disconnect that account. Please try again.')
        } finally {
          setPendingId(null)
        }
      })
    },
    [optimisticallyRemove],
  )

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Connected accounts</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          What&apos;s feeding the ledger.
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Disconnecting an account removes it and every transaction it pulled in. This can&apos;t be
          undone.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-[#dc2626] bg-[#fef2f2] px-4 py-3 text-sm text-[#dc2626]">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
          No accounts connected.{' '}
          <Link href="/dashboard/connect" className="font-medium text-accent hover:text-accent-hover">
            Connect one
          </Link>{' '}
          to start the ledger.
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
          {visible.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-bg-alt font-display text-xs font-semibold text-ink"
                >
                  {a.display_name.charAt(0)}
                </span>
                <span className="truncate text-sm font-medium text-ink">{a.display_name}</span>
                {a.last4 ? (
                  <span className="tabular font-mono text-xs text-subtle">•••• {a.last4}</span>
                ) : null}
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  {PROVIDER_LABEL[a.provider] ?? a.provider}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDisconnect(a.id)}
                disabled={pendingId === a.id}
                className="shrink-0 rounded-md border border-[#dc2626] px-3 py-1.5 text-xs font-medium text-[#dc2626] transition hover:bg-[#fef2f2] disabled:opacity-50"
              >
                {pendingId === a.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AgentKeysSection() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Agent keys</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          Keys your agents tag with.
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Mint, label, and revoke the MCP bearer tokens Claude Code or Cursor use to read and tag
          your ledger.
        </p>
      </div>
      <div>
        <Link
          href="/dashboard/connect"
          className="inline-flex items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-line-strong"
        >
          Manage agent keys on Connect →
        </Link>
      </div>
    </section>
  )
}

function DangerZone() {
  const [confirmation, setConfirmation] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  const armed = confirmation.trim().toLowerCase() === CONFIRM_PHRASE

  const handleDelete = useCallback(() => {
    if (!armed) return
    setError(null)
    startTransition(async () => {
      try {
        // On success this server action redirects to /onboarding and never
        // returns. A thrown error means it didn't get that far.
        await deleteAllDataAction(confirmation)
      } catch {
        setError('Something went wrong. Your data was not deleted — please try again.')
      }
    })
  }, [armed, confirmation])

  return (
    <section className="rounded-md border border-[#dc2626] bg-[#fef2f2] p-6">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#dc2626]">Danger zone</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
        Delete all my data.
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Permanently erases every project, account, transaction, agent key, and setting tied to your
        account. This cannot be undone and only ever affects your own data. You&apos;ll start fresh
        from onboarding.
      </p>

      <label htmlFor={inputId} className="mt-5 block text-sm font-medium text-ink">
        Type <span className="font-mono text-[#dc2626]">{CONFIRM_PHRASE}</span> to confirm
      </label>
      <input
        id={inputId}
        type="text"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={CONFIRM_PHRASE}
        disabled={pending}
        className={cn(
          'mt-2 w-full max-w-xs rounded-md border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
          'placeholder:text-subtle focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626]',
          'border-line disabled:opacity-50',
        )}
      />

      {error ? (
        <p className="mt-3 rounded-md border border-[#dc2626] bg-surface px-4 py-3 text-sm text-[#dc2626]">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!armed || pending}
          className={cn(
            'rounded-md px-5 py-2.5 text-sm font-medium transition',
            'bg-[#dc2626] text-white hover:bg-[#b91c1c]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {pending ? 'Deleting everything…' : 'Delete all my data'}
        </button>
      </div>
    </section>
  )
}
