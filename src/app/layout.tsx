import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
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

// Clerk crashes at runtime without a publishable key. When Clerk isn't
// configured for this deployment, render the shell without the provider.
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export const metadata: Metadata = {
  title: 'foundr.money — Agent-first budgeting that tracks every project’s burn',
  description:
    'Per-project P&L, agent-native spend tagging over MCP, and first-class AI/cloud invoice ingestion. Built for the founder running five things on one card. No entity required.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const shell = (
    <html
      lang="en"
      className={`${poppins.variable} ${roboto.variable} ${inconsolata.variable}`}
    >
      <body>{children}</body>
    </html>
  )

  if (!CLERK_ENABLED) return shell

  // Suspense wrapper required under cacheComponents: ClerkProvider reads
  // request-time auth state, and Next.js needs a Suspense boundary between the
  // cached scope and any dynamic-API consumer. See Clerk PR #7119.
  return (
    <Suspense fallback={shell}>
      <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
        {shell}
      </ClerkProvider>
    </Suspense>
  )
}
