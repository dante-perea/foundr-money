import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { SignInForm } from './sign-in-form'
import { CLERK_IS_SATELLITE, SIGN_IN_URL, clerkProviderProps } from '@/lib/clerk-satellite'

// Force this route dynamic — Clerk's client form can't render under the
// Suspense fallback that wraps ClerkProvider during prerender. `connection()`
// opts out of build-time prerender; ClerkProvider is scoped to this route (not
// the static root) and the form lives behind a 'use client' boundary.
export default async function SignInPage() {
  // Satellites don't host sign-in — bounce to the primary (foundr.company).
  if (CLERK_IS_SATELLITE) redirect(SIGN_IN_URL)
  await connection()
  return (
    <ClerkProvider {...clerkProviderProps} afterSignInUrl="/dashboard">
      <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
        <Suspense fallback={<div className="min-h-screen" />}>
          <SignInForm />
        </Suspense>
      </main>
    </ClerkProvider>
  )
}
