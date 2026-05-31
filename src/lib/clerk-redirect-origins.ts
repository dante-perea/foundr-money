// Origins Clerk is allowed to redirect to after auth — the foundr.* satellites.
// Passed to `<ClerkProvider allowedRedirectOrigins>` so a cross-origin
// `signInForceRedirectUrl` back to a satellite (e.g. from the primary's
// /sso-callback on a fresh sign-in) passes Clerk's own safe-redirect check.
// Without it, Clerk drops the cross-origin target as unsafe and falls back to
// its default afterSignIn URL.
//
// These are plain strings (NOT RegExp): Clerk runs each string entry through
// glob-to-regexp, so `*` wildcards work for lab subdomains. Mirrors the
// foundr.world reference (src/lib/auth/redirect-target.ts) — keep the foundr.*
// product list in sync when a new satellite ships, and include foundr.money's
// own origins so a primary-initiated sign-in returns here cleanly.
export const clerkAllowedRedirectOrigins: string[] = [
  'https://foundr.company',
  'https://www.foundr.company',
  'https://foundr.money',
  'https://www.foundr.money',
  'https://foundr-money.vercel.app',
  'https://foundr.host',
  'https://www.foundr.host',
  'https://*.lab.foundr.host',
  'https://foundr.mobile',
  'https://www.foundr.mobile',
  'https://*.lab.foundr.mobile',
  'https://foundr.work',
  'https://www.foundr.work',
  'https://*.lab.foundr.work',
  'https://foundr.world',
  'https://www.foundr.world',
  'https://*.lab.foundr.world',
]
