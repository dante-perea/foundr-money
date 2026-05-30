// Client-safe project palette — constants only, NO server/db imports, so this
// can be pulled into the 'use client' onboarding bundle without leaking
// `postgres`/service-role into the browser.
//
// Deterministic auto-assignment: the Nth project a founder adds always takes
// PROJECT_PALETTE[N % length]. No color picker — auto-assignment is the
// brand-correct, decision-free behavior. Index 0 is the accent (#3b82f6).
// Blues → indigo → teal family; all legible on white; never sage/lime.

export const PROJECT_PALETTE = [
  '#3b82f6', // blue (accent)
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#ef4444', // red
  '#14b8a6', // teal
  '#a855f7', // purple
  '#0ea5e9', // sky
  '#f97316', // orange
] as const

/** The color the next project (0-indexed by current count) will be given. */
export function nextProjectColor(count: number): string {
  return PROJECT_PALETTE[count % PROJECT_PALETTE.length]
}
