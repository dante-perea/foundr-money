import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

// Clerk crashes at runtime without a publishable key. When Clerk isn't
// configured for this deployment, render the shell without the provider so
// the app still boots.
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export const metadata: Metadata = {
  title: 'foundr.money — project-first budgeting',
  description:
    'Per-project P&L, agent-native spend tagging over MCP, and first-class AI/cloud invoice ingestion. Built for the founder running five things on one card. No entity required.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const shell = (
    <html lang="en">
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
