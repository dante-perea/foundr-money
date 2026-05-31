'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  CLERK_IS_SATELLITE,
  CLERK_SATELLITE_DOMAIN,
  satelliteSignInUrl,
  satelliteSignUpUrl,
} from '@/lib/clerk-satellite'

type AuthMode = 'sign-in' | 'sign-up'

interface Props {
  mode: AuthMode
  children: ReactNode
  className?: string
  returnPath?: string
}

function returnUrl(returnPath: string): string {
  if (typeof window === 'undefined') {
    if (CLERK_IS_SATELLITE && CLERK_SATELLITE_DOMAIN) {
      return new URL(returnPath, `https://${CLERK_SATELLITE_DOMAIN}`).toString()
    }
    return returnPath
  }
  return new URL(returnPath, window.location.origin).toString()
}

function fallbackHref(mode: AuthMode, returnPath: string): string {
  if (!CLERK_IS_SATELLITE) return mode === 'sign-in' ? '/sign-in' : '/sign-up'
  const target = returnUrl(returnPath)
  return mode === 'sign-in' ? satelliteSignInUrl(target) : satelliteSignUpUrl(target)
}

export function AuthRedirectLink({
  mode,
  children,
  className,
  returnPath = '/dashboard',
}: Props) {
  const href = fallbackHref(mode, returnPath)

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
