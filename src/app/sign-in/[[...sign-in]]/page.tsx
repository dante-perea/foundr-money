import { Suspense } from 'react'
import { connection } from 'next/server'
import { SignInForm } from './sign-in-form'

// Force this route dynamic — Clerk's client form can't render under the
// Suspense fallback that wraps ClerkProvider during prerender. `connection()`
// opts out of build-time prerender; the form lives behind a 'use client'
// boundary inside <Suspense>.
export default async function SignInPage() {
  await connection()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <Suspense fallback={<div className="min-h-screen" />}>
        <SignInForm />
      </Suspense>
    </main>
  )
}
