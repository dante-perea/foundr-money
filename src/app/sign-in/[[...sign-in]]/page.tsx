import { Suspense } from 'react'
import { connection } from 'next/server'
import { ClerkProvider } from '@clerk/nextjs'
import { SignInForm } from './sign-in-form'

// Force this route dynamic — Clerk's client form can't render under the
// Suspense fallback that wraps ClerkProvider during prerender. `connection()`
// opts out of build-time prerender; ClerkProvider is scoped to this route (not
// the static root) and the form lives behind a 'use client' boundary.
export default async function SignInPage() {
  await connection()
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard">
      <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
        <Suspense fallback={<div className="min-h-screen" />}>
          <SignInForm />
        </Suspense>
      </main>
    </ClerkProvider>
  )
}
