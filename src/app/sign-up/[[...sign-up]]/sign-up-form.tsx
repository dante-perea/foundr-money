'use client'

import { SignUp } from '@clerk/nextjs'

export function SignUpForm() {
  return <SignUp signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
}
