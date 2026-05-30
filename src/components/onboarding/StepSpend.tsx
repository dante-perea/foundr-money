'use client'

import { McpKeyCard } from './McpKeyCard'
import { QuickExpenseCard } from './QuickExpenseCard'
import { BankConnectCard } from './BankConnectCard'
import type { MintedKey, AddedExpense } from '@/app/onboarding/actions'
import type { WizardProject } from '@/app/onboarding/onboarding-client'

/**
 * Step 2 — produce the aha signal. Three independent option cards (do one, do
 * all, or skip). MCP is first and visually elevated (the moat). Vertically
 * stacked — the cards carry different weights and the command needs to breathe.
 */
export function StepSpend({
  appUrl,
  plaidConfigured,
  projects,
  exampleProject,
  minted,
  expenseCount,
  onMinted,
  onExpenseAdded,
}: {
  appUrl: string
  plaidConfigured: boolean
  projects: WizardProject[]
  exampleProject: string
  minted: MintedKey | null
  expenseCount: number
  onMinted: (k: MintedKey) => void
  onExpenseAdded: (e: AddedExpense) => void
}) {
  return (
    <div className="flex flex-1 flex-col pb-8 pt-2">
      <h1
        tabIndex={-1}
        className="font-display text-3xl font-semibold tracking-tight text-ink focus:outline-none sm:text-4xl"
      >
        bring in your spend.
      </h1>
      <p className="mt-2 text-sm text-muted">
        three ways in. do one, do all, or skip — whatever gets you to a real number fastest. tagging
        from your editor is the fast lane.
      </p>

      <div className="mt-6 space-y-4">
        <McpKeyCard
          appUrl={appUrl}
          exampleProject={exampleProject}
          minted={minted}
          onMinted={onMinted}
        />
        <QuickExpenseCard projects={projects} count={expenseCount} onAdded={onExpenseAdded} />
        <BankConnectCard plaidConfigured={plaidConfigured} />
      </div>

      {minted && expenseCount === 0 && (
        <p className="mt-4 text-xs text-subtle">
          tip: log one expense to see the dashboard come alive.
        </p>
      )}
    </div>
  )
}
