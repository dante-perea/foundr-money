import { Suspense } from 'react'
import { connection } from 'next/server'
import { ClerkProvider } from '@clerk/nextjs'
import { SignUpForm } from './sign-up-form'

// See sign-in page for the cacheComponents + Clerk rationale.
export default async function SignUpPage() {
  await connection()
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignUpUrl="/dashboard">
      <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
        <Suspense fallback={<div className="min-h-screen" />}>
          <SignUpForm />
        </Suspense>
      </main>
    </ClerkProvider>
  )
}
