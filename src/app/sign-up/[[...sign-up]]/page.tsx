import { Suspense } from 'react'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignUpForm } from './sign-up-form'
import {
  CLERK_IS_SATELLITE,
  CLERK_SATELLITE_DOMAIN,
  satelliteSignUpUrl,
} from '@/lib/clerk-satellite'

// See sign-in page for the cacheComponents + Clerk rationale. ClerkProvider is
// root-mounted (src/app/layout.tsx); this page no longer wraps its own.
export default async function SignUpPage() {
  // Satellites don't host sign-up — bounce to the primary (foundr.company).
  if (CLERK_IS_SATELLITE) {
    const requestHeaders = await headers()
    const host =
      requestHeaders.get('x-forwarded-host') ??
      requestHeaders.get('host') ??
      CLERK_SATELLITE_DOMAIN
    redirect(satelliteSignUpUrl(`https://${host}/dashboard`))
  }
  await connection()
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
      <Suspense fallback={<div className="min-h-screen" />}>
        <SignUpForm />
      </Suspense>
    </main>
  )
}
