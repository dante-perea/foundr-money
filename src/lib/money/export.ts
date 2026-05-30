import 'server-only'
import { db } from './db'
import { centsToDollars } from './money'

// Tax-aware Schedule C export. Data prep, not tax advice.
//
// House sign convention: EXPENSE = POSITIVE, income = negative. Schedule C is
// about deductible *expenses*, so we surface positive-amount allocations as
// deductions on their mapped line. We also emit a 1099-NEC candidates section:
// any vendor paid >= $600 in the year on a contract-labor / legal line.

/** Schedule C lines that trigger 1099-NEC reporting (contract labor, legal). */
const NEC_SCHEDULE_C_LINES = new Set(['L11', 'L17'])
/** Dollar threshold (in cents) above which a vendor is a 1099-NEC candidate. */
const NEC_THRESHOLD_CENTS = 60000

interface ExportRow {
  project: string
  schedule_c_line: string
  category: string
  date: string // YYYY-MM-DD
  merchant: string
  amount_cents: number // expense positive
}

/** RFC-4180-ish CSV cell escaping. */
function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(',')
}

/** Format integer cents as a plain decimal-dollar string (no symbol). */
function dollars(cents: number): string {
  return centsToDollars(cents).toFixed(2)
}

interface RawAllocRow {
  amount_cents: number
  transactions: {
    posted_at: string
    merchant_name: string | null
    description: string | null
  } | null
  projects: { name: string } | null
  categories: { label: string; schedule_c_line: string | null; is_income: boolean } | null
}

/**
 * Build a tax-aware Schedule C CSV for `owner` and `year`.
 *
 * Returns a single CSV string with two sections:
 *   1. Per-allocation deduction rows (project, Schedule C line, category, date,
 *      merchant, amount in dollars) — expenses only, income excluded.
 *   2. A "1099-NEC candidates" section listing vendors paid >= $600 total in the
 *      year on contract-labor / legal-&-professional lines.
 */
export async function buildScheduleCCsv(owner: string, year: number): Promise<string> {
  const start = `${year}-01-01`
  const end = `${year}-12-31`

  // Allocations joined to their transaction (for date/merchant + the year
  // filter), project (name) and category (Schedule C line/label). The year
  // filter is applied to the *embedded* transactions relation.
  const { data, error } = await db()
    .from('transaction_allocations')
    .select(
      `amount_cents,
       transactions!inner ( posted_at, merchant_name, description ),
       projects ( name ),
       categories ( label, schedule_c_line, is_income )`,
    )
    .eq('owner_id', owner)
    .gte('transactions.posted_at', start)
    .lte('transactions.posted_at', end)
    .order('amount_cents', { ascending: false })

  if (error) throw error

  const allocations = (data ?? []) as unknown as RawAllocRow[]

  // Build the deduction rows — expenses only (positive amount, not income).
  const rows: ExportRow[] = []
  // 1099-NEC tally: vendor merchant → total cents on NEC lines.
  const necTotals = new Map<string, number>()

  for (const a of allocations) {
    const txn = a.transactions
    if (!txn) continue
    const cat = a.categories
    const isIncome = cat?.is_income ?? false
    // Schedule C deductions are expenses (house sign: positive). Skip income
    // and any net-negative allocation (refunds/credits net against the line).
    if (isIncome || a.amount_cents <= 0) continue

    const line = cat?.schedule_c_line ?? ''
    const merchant = txn.merchant_name?.trim() || txn.description?.trim() || '(unknown)'

    rows.push({
      project: a.projects?.name ?? '(unassigned)',
      schedule_c_line: line,
      category: cat?.label ?? '(uncategorized)',
      date: txn.posted_at,
      merchant,
      amount_cents: a.amount_cents,
    })

    if (line && NEC_SCHEDULE_C_LINES.has(line)) {
      necTotals.set(merchant, (necTotals.get(merchant) ?? 0) + a.amount_cents)
    }
  }

  // Sort deduction rows by Schedule C line, then by date, for a clean export.
  rows.sort((x, y) => {
    if (x.schedule_c_line !== y.schedule_c_line)
      return x.schedule_c_line.localeCompare(y.schedule_c_line)
    return x.date.localeCompare(y.date)
  })

  const lines: string[] = []

  // Header banner — this is data prep, not tax advice.
  lines.push(csvRow([`foundr.money — Schedule C export — tax year ${year}`]))
  lines.push(csvRow(['Data prep, not tax advice. Review with your accountant.']))
  lines.push('')

  // Section 1 — deductions.
  lines.push(csvRow(['Project', 'Schedule C line', 'Category', 'Date', 'Merchant', 'Amount (USD)']))
  let total = 0
  for (const r of rows) {
    total += r.amount_cents
    lines.push(
      csvRow([r.project, r.schedule_c_line, r.category, r.date, r.merchant, dollars(r.amount_cents)]),
    )
  }
  if (rows.length === 0) {
    lines.push(csvRow(['(no deductible expenses found for this year)']))
  }
  lines.push(csvRow(['', '', '', '', 'Total deductions', dollars(total)]))
  lines.push('')

  // Section 2 — 1099-NEC candidates (>= $600 on contract labor / legal lines).
  lines.push(csvRow(['1099-NEC candidates']))
  lines.push(
    csvRow([
      `Vendors paid $600 or more in ${year} on contract-labor (L11) or legal & professional (L17) lines.`,
    ]),
  )
  lines.push(csvRow(['Vendor', 'Total paid (USD)']))
  const candidates = [...necTotals.entries()]
    .filter(([, cents]) => cents >= NEC_THRESHOLD_CENTS)
    .sort((a, b) => b[1] - a[1])
  if (candidates.length === 0) {
    lines.push(csvRow(['(no vendors crossed the $600 threshold)']))
  } else {
    for (const [vendor, cents] of candidates) {
      lines.push(csvRow([vendor, dollars(cents)]))
    }
  }

  // Trailing newline so the file ends cleanly.
  return lines.join('\n') + '\n'
}
