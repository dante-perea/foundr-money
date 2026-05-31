import { Suspense } from 'react'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignInForm } from './sign-in-form'
import {
  CLERK_IS_SATELLITE,
  CLERK_SATELLITE_DOMAIN,
  satelliteSignInUrl,
} from '@/lib/clerk-satellite'

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
  if (CLERK_IS_SATELLITE) {
    const requestHeaders = await headers()
    const host =
      requestHeaders.get('x-forwarded-host') ??
      requestHeaders.get('host') ??
      CLERK_SATELLITE_DOMAIN
    redirect(satelliteSignInUrl(`https://${host}/dashboard`))
  }
  await connection()
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
      <Suspense fallback={<div className="min-h-screen" />}>
        <SignInForm />
      </Suspense>
    </main>
  )
}
