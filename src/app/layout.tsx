import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Poppins, Roboto, Inconsolata } from 'next/font/google'
import { SatelliteClerkProvider } from '@/components/auth/satellite-clerk-provider'
import './globals.css'

// Gate the provider on a configured publishable key so a keyless build stays
// green — clerk-js throws at boot when no key is present.
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

// Brand fonts — match foundr.company: Poppins (display), Roboto (body),
// Inconsolata (mono labels/numbers).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
})
const inconsolata = Inconsolata({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inconsolata',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'foundr.money — Agent-first budgeting that tracks every project’s burn',
  description:
    'Per-project P&L, agent-native spend tagging over MCP, and first-class AI/cloud invoice ingestion. Built for the founder running five things on one card. No entity required.',
}

// ClerkProvider is ROOT-MOUNTED (the satellite-correct pattern): clerk-js must
// boot on EVERY page so a visitor already signed in on the primary
// (foundr.company) syncs their session on an organic visit to ANY foundr.money
// page — marketing, pricing, dashboard. It lives behind the root <Suspense>
// boundary because cacheComponents is on (next.config.ts) and the provider is a
// client component; the boundary lets static pages still prerender. Gated on
// CLERK_ENABLED so a keyless build stays green.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${roboto.variable} ${inconsolata.variable}`}>
      {/* Root Suspense boundary: lets dynamic-API reads (connection()/auth()) in
          child route segments defer during prerender, and lets the client
          SatelliteClerkProvider mount without forcing the static shell dynamic. */}
      <body>
        <Suspense fallback={null}>
          {CLERK_ENABLED ? (
            <SatelliteClerkProvider>{children}</SatelliteClerkProvider>
          ) : (
            children
          )}
        </Suspense>
      </body>
    </html>
  )
}
