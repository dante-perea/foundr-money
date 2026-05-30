// Money formatting. Internal representation is integer cents.
// House sign convention: expense = positive, income = negative.

export function formatCents(cents: number, currency = 'usd', opts?: { signed?: boolean }): string {
  const dollars = cents / 100
  const out = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(dollars))
  if (opts?.signed) return (cents < 0 ? '−' : '') + out
  return out
}

/** Compact form for big dashboard numbers, e.g. $1.2k, $12.3k. */
export function formatCompact(cents: number, currency = 'usd'): string {
  const dollars = Math.abs(cents) / 100
  if (dollars < 1000) return formatCents(Math.abs(cents), currency)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(dollars)
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

/** Normalize a merchant name to a stable matching token. */
export function normalizeMerchant(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
