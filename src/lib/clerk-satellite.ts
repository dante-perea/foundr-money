// foundr.money runs as a Clerk *satellite* of the foundr.company primary in
// production. Users sign in on foundr.company; foundr.money reads the synced
// session. All satellite config is env-driven so local dev (with the dev
// instance keys) keeps working unchanged until the production cutover.
//
// Required prod env (set at cutover, NOT before — pk_live only works on
// registered satellite domains, so it must not deploy to foundr-money.vercel.app):
//   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_…            (foundr.company instance)
//   CLERK_SECRET_KEY                  = sk_live_…
//   NEXT_PUBLIC_CLERK_IS_SATELLITE    = true
//   NEXT_PUBLIC_CLERK_PRIMARY_URL     = https://foundr.company
//   NEXT_PUBLIC_CLERK_SATELLITE_DOMAIN= foundr.money

export const CLERK_IS_SATELLITE = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true'
export const CLERK_PRIMARY_URL = process.env.NEXT_PUBLIC_CLERK_PRIMARY_URL ?? ''
export const CLERK_SATELLITE_DOMAIN = process.env.NEXT_PUBLIC_CLERK_SATELLITE_DOMAIN ?? ''

/** Primary-hosted sign-in/up URLs in satellite mode; local routes otherwise. */
export const SIGN_IN_URL = CLERK_IS_SATELLITE ? `${CLERK_PRIMARY_URL}/sign-in` : '/sign-in'
export const SIGN_UP_URL = CLERK_IS_SATELLITE ? `${CLERK_PRIMARY_URL}/sign-up` : '/sign-up'

// The <ClerkProvider> props formerly exported here (`clerkProviderProps`) are
// gone: the provider is now ROOT-MOUNTED via the 'use client'
// SatelliteClerkProvider (src/components/auth/satellite-clerk-provider.tsx),
// which derives `domain` from the live window.location.host (string form — the
// satellite-correct pattern) and adds allowedRedirectOrigins. Root-mounting is
// what lets clerk-js boot on every page so an already-signed-in-on-primary
// visitor syncs on an organic visit. Do NOT re-add a per-route provider.

/** Options passed to clerkMiddleware() in src/proxy.ts. */
export const clerkMiddlewareOptions = CLERK_IS_SATELLITE
  ? { isSatellite: true, domain: CLERK_SATELLITE_DOMAIN, signInUrl: SIGN_IN_URL }
  : {}
