import { twMerge } from 'tailwind-merge'

/** Join + dedupe Tailwind classes. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '))
}
