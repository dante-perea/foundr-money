import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Poppins, Roboto, Inconsolata } from 'next/font/google'
import './globals.css'

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

// ClerkProvider is intentionally NOT at the root: marketing pages (/, /pricing)
// stay fully static. ClerkProvider lives on the dynamic routes that need it —
// the dashboard layout and the auth pages — so it never enters the prerender
// path. See dashboard/layout.tsx and sign-in|sign-up/page.tsx.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${roboto.variable} ${inconsolata.variable}`}>
      {/* Root Suspense boundary: lets dynamic-API reads (connection()/auth()) in
          child route segments defer during prerender. Static pages with no
          dynamic data still prerender fully. ClerkProvider lives in the
          dashboard + auth sections, not here. */}
      <body>
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  )
}
