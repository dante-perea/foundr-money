import { Suspense } from 'react'
import { connection } from 'next/server'
import { SignUpForm } from './sign-up-form'

// See sign-in page for the cacheComponents + Clerk rationale.
export default async function SignUpPage() {
  await connection()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <Suspense fallback={<div className="min-h-screen" />}>
        <SignUpForm />
      </Suspense>
    </main>
  )
}
