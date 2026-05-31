'use client'

import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import { CLERK_IS_SATELLITE, CLERK_PRIMARY_URL } from '@/lib/clerk-satellite'
import { clerkAllowedRedirectOrigins } from '@/lib/clerk-redirect-origins'

// The primary (foundr.company) ships its own Clerk sign-in/up. Point the
// satellite there. NEXT_PUBLIC_ so this client component reads the same value
// the proxy does. Canonical www host — apex 301s to www.
const PRIMARY_AUTH_BASE = CLERK_PRIMARY_URL || 'https://www.foundr.company'

/**
 * Client-side ClerkProvider for this deployment, root-mounted so clerk-js
 * boots on EVERY page — that is what lets a visitor who is already signed in on
 * the primary (foundr.company) sync their session on an organic visit to any
 * foundr.money page (marketing, pricing, dashboard).
 *
 * In production this Vercel project serves the SATELLITE host (foundr.money);
 * the PRIMARY Clerk instance lives on foundr.company. Without isSatellite +
 * domain, Clerk runs in primary mode and the satellite session handshake never
 * fires, so the synced session is never read and sign-in / OAuth-consent break.
 *
 * `domain` must be the SATELLITE's own host so clerk-js runs the satellite
 * handshake against the primary FAPI. It is supplied as a STRING derived from
 * `window.location.host` — NOT the function form `(url) => url.host`. Clerk's
 * IsomorphicClerk `domain` getter THROWS on a function in any non-browser
 * environment, and the App Router SSRs/prerenders every page — so the function
 * form crashes the build outright. A string passes through untouched in both
 * environments. During SSR `window` is undefined, so we emit `''` (harmless:
 * clerk-js only completes the handshake in the browser, where it re-reads the
 * real host); on the client we pass the live `window.location.host`.
 *
 * Strip a leading `www.`: the registered satellite domain is the apex
 * `foundr.money` (clerk.foundr.money is the DNS-configured FAPI). On
 * `www.foundr.money` the raw host would make clerk-js target
 * `clerk.www.foundr.money`, which is NOT a Clerk endpoint → the handshake fails
 * with ERR_CONNECTION_CLOSED. Using `foundr.money` hits the live FAPI.
 *
 * Satellite config is gated on CLERK_IS_SATELLITE (env-driven). In local dev
 * (dev-instance keys, satellite OFF) this renders a plain primary provider with
 * local /sign-in /sign-up routes so the dev sign-in flow keeps working.
 */
export function SatelliteClerkProvider({ children }: { children: ReactNode }) {
  if (!CLERK_IS_SATELLITE) {
    return (
      <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
        {children}
      </ClerkProvider>
    )
  }

  const domain =
    typeof window !== 'undefined' ? window.location.host.replace(/^www\./, '') : ''

  return (
    <ClerkProvider
      isSatellite
      domain={domain}
      signInUrl={`${PRIMARY_AUTH_BASE}/sign-in`}
      signUpUrl={`${PRIMARY_AUTH_BASE}/sign-up`}
      allowedRedirectOrigins={clerkAllowedRedirectOrigins}
    >
      {children}
    </ClerkProvider>
  )
}
