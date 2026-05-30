// Canonical foundr.money types. Money is always integer cents.
// House sign convention: EXPENSE = POSITIVE, income = negative.

export type ProjectStatus = 'active' | 'archived'
export type AccountProvider =
  | 'plaid'
  | 'stripe'
  | 'manual'
  | 'openai'
  | 'anthropic'
  | 'vercel'
  | 'supabase'
  | 'cursor'
export type AccountKind = 'card' | 'bank' | 'stripe_account' | 'provider_invoice'
export type TxnDirection = 'income' | 'expense'

export interface Project {
  id: string
  owner_id: string
  name: string
  slug: string
  status: ProjectStatus
  is_personal: boolean
  color: string
  description: string | null
  created_at: string
}

export interface Category {
  id: string
  owner_id: string | null
  label: string
  schedule_c_line: string | null
  is_income: boolean
  sort: number
}

export interface FinancialAccount {
  id: string
  owner_id: string
  provider: AccountProvider
  kind: AccountKind
  display_name: string
  last4: string | null
  currency: string
  plaid_item_id: string | null
  plaid_account_id: string | null
  stripe_account_id: string | null
  status: string
  last_synced_at: string | null
  created_at: string
}

export interface Transaction {
  id: string
  owner_id: string
  financial_account_id: string
  external_id: string
  posted_at: string
  authorized_at: string | null
  amount_cents: number
  raw_amount_cents: number
  raw_sign_source: string
  direction: TxnDirection
  currency: string
  merchant_name: string | null
  description: string | null
  pfc_primary: string | null
  pfc_detailed: string | null
  pfc_confidence: string | null
  pending: boolean
  created_at: string
}

export interface Allocation {
  id: string
  owner_id: string
  transaction_id: string
  project_id: string
  category_id: string | null
  amount_cents: number
  pct: number | null
  note: string | null
  created_at: string
}

/** A transaction joined with its allocations (+ resolved project names). */
export interface TransactionWithAllocations extends Transaction {
  allocations: (Allocation & { project_name: string; project_slug: string; project_color: string })[]
  account_name: string
  account_provider: AccountProvider
}

/** Per-project P&L rollup for a period. */
export interface ProjectPnl {
  project_id: string
  project_name: string
  project_slug: string
  project_color: string
  is_personal: boolean
  income_cents: number
  expense_cents: number
  net_cents: number
  mrr_cents: number
  txn_count: number
}

/** Source-agnostic ingest row. Every adapter maps INTO this. */
export interface RawTransaction {
  external_id: string
  source: 'plaid' | 'csv' | 'invoice' | 'manual' | 'stripe' | 'vercel'
  account_ref: string // financial_account_id
  amount_cents: number // NORMALIZED: expense = positive
  raw_amount_cents: number
  raw_sign_source: string
  currency: string
  occurred_on: string // YYYY-MM-DD
  posted_on: string
  merchant_hint: string | null
  description: string | null
  category_hint?: string | null
  pfc_primary?: string | null
  pfc_detailed?: string | null
  pfc_confidence?: string | null
  pending?: boolean
}
