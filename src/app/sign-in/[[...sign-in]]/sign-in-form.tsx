'use client'

import { SignIn } from '@clerk/nextjs'

export function SignInForm() {
  return <SignIn signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
}
