import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { SignUpForm } from './sign-up-form'
import { CLERK_IS_SATELLITE, SIGN_UP_URL, clerkProviderProps } from '@/lib/clerk-satellite'

// See sign-in page for the cacheComponents + Clerk rationale.
export default async function SignUpPage() {
  // Satellites don't host sign-up — bounce to the primary (foundr.company).
  if (CLERK_IS_SATELLITE) redirect(SIGN_UP_URL)
  await connection()
  return (
    <ClerkProvider {...clerkProviderProps} afterSignUpUrl="/dashboard">
      <main className="flex min-h-screen items-center justify-center bg-bg-alt p-6">
        <Suspense fallback={<div className="min-h-screen" />}>
          <SignUpForm />
        </Suspense>
      </main>
    </ClerkProvider>
  )
}
