'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link'
import { cn } from '@/lib/cn'

type Phase =
  | 'idle'
  | 'requesting'
  | 'not_configured'
  | 'linking' // token in hand, waiting for Link to be ready
  | 'opened' // Link UI is open
  | 'exchanging'
  | 'error'

/**
 * Connect-a-bank button. Flow:
 *   click → POST /api/plaid/link-token
 *     · {error:'plaid_not_configured'} → tasteful inline note (demo data is loaded)
 *     · {link_token}                    → open Plaid Link
 *   onSuccess → POST /api/plaid/exchange {public_token} → router.refresh()
 *
 * The Link handler needs a token before it can open, so we fetch the token on
 * click, store it, and open Link from a one-shot effect once Link is ready.
 */
export function PlaidConnectButton() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token) => {
      setPhase('exchanging')
      try {
        const res = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ public_token }),
        })
        if (!res.ok) throw new Error('exchange_failed')
        setPhase('idle')
        setLinkToken(null)
        router.refresh()
      } catch {
        setPhase('error')
        setMessage('Could not finish connecting that account. Try again.')
      }
    },
    [router],
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      // User backed out — reset to idle so they can retry.
      setPhase((p) => (p === 'exchanging' ? p : 'idle'))
      setLinkToken(null)
    },
  })

  const requestToken = useCallback(async () => {
    setMessage(null)
    setPhase('requesting')
    try {
      const res = await fetch('/api/plaid/link-token', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        link_token?: string
        error?: string
      }
      if (data.error === 'plaid_not_configured' || !data.link_token) {
        setPhase('not_configured')
        return
      }
      setLinkToken(data.link_token)
      setPhase('linking')
    } catch {
      setPhase('error')
      setMessage('Could not reach Plaid. Your demo data is loaded below.')
    }
  }, [])

  // Once we have a token and Link is ready, open it exactly once.
  useEffect(() => {
    if (phase === 'linking' && ready && linkToken) {
      setPhase('opened')
      open()
    }
  }, [phase, ready, linkToken, open])

  const busy =
    phase === 'requesting' || phase === 'linking' || phase === 'opened' || phase === 'exchanging'

  return (
    <div>
      <button
        type="button"
        onClick={requestToken}
        disabled={busy}
        className={cn(
          'rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
          busy && 'cursor-wait opacity-70',
        )}
      >
        {phase === 'requesting'
          ? 'Opening Plaid…'
          : phase === 'exchanging'
            ? 'Linking account…'
            : 'Connect a bank'}
      </button>

      {phase === 'not_configured' && (
        <p className="mt-3 rounded-md border border-line bg-bg-alt px-3 py-2 text-xs leading-relaxed text-muted">
          Sandbox not configured — your demo data is already loaded below. Live Plaid linking turns on
          once a sandbox key is set.
        </p>
      )}
      {phase === 'error' && message && (
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning">
          {message}
        </p>
      )}
    </div>
  )
}
