import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { SignInForm } from './sign-in-form'
import { CLERK_IS_SATELLITE, SIGN_IN_URL } from '@/lib/clerk-satellite'

// ClerkProvider is root-mounted (src/app/layout.tsx) — this page no longer
// wraps its own. `connection()` opts out of build-time prerender so the Clerk
// client form isn't evaluated under the root Suspense fallback during
// prerender; the form lives behind a 'use client' boundary.
//
// In SATELLITE mode this route is dead-codeish — we redirect to the primary's
// sign-in before rendering. The local <SignIn> form below only renders in dev
// (satellite OFF, dev-instance keys).
export default async function SignInPage() {
  // Satellites don't host sign-in — bounce to the primary (foundr.company).
  if (CLERK_IS_SATELLITE) redirect(SIGN_IN_URL)
  await connection()
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
      <Suspense fallback={<div className="min-h-screen" />}>
        <SignInForm />
      </Suspense>
    </main>
  )
}
