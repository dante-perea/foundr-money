import { cn } from '@/lib/cn'
import type { AccountProvider } from '@/lib/money/types'

export interface ProviderSpec {
  provider: AccountProvider
  name: string
  /** What native granularity maps spend to a project. */
  granularity: string
  /** One-line description of how connecting maps spend to projects. */
  blurb: string
}

/** The provider connectors foundr.money understands natively. */
export const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'openai',
    name: 'OpenAI',
    granularity: 'project_id',
    blurb: 'Splits API usage by OpenAI project — each project_id maps straight to a foundr project.',
  },
  {
    provider: 'anthropic',
    name: 'Anthropic',
    granularity: 'workspace_id',
    blurb: 'Claude spend lands per workspace_id — pair a workspace once, tagged forever.',
  },
  {
    provider: 'vercel',
    name: 'Vercel',
    granularity: 'projectId',
    blurb: 'Per-deployment billing already carries a native projectId — zero guessing.',
  },
  {
    provider: 'supabase',
    name: 'Supabase',
    granularity: 'org / project',
    blurb: 'Maps each Supabase project invoice to the founder project it powers.',
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    granularity: 'account',
    blurb: 'Rolls MRR and payouts up per connected Stripe account — multi-product safe.',
  },
]

interface ConnectedAccountLite {
  display_name: string
  last4: string | null
}

/**
 * A provider connector card. Presentational — shows the native granularity that
 * maps spend to projects, any already-connected demo accounts, and a "Connect"
 * affordance (no live OAuth in v1).
 */
export function ProviderCard({
  spec,
  accounts,
}: {
  spec: ProviderSpec
  accounts: ConnectedAccountLite[]
}) {
  const connected = accounts.length > 0
  return (
    <div className="flex flex-col rounded-md border border-line bg-surface p-5 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg-alt font-display text-sm font-semibold text-ink"
          >
            {spec.name.charAt(0)}
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-ink">{spec.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              {spec.granularity}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]',
            connected ? 'bg-success/10 text-success' : 'border border-line text-subtle',
          )}
        >
          {connected ? (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              Connected
            </>
          ) : (
            'Not connected'
          )}
        </span>
      </div>

      <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">{spec.blurb}</p>

      {connected ? (
        <ul className="mt-3 space-y-1">
          {accounts.map((a) => (
            <li key={a.display_name} className="flex items-center justify-between text-xs text-ink">
              <span className="truncate">{a.display_name}</span>
              {a.last4 ? <span className="tabular font-mono text-subtle">•••• {a.last4}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          disabled
          title="Live OAuth ships next — demo accounts are already mapped below."
          className="mt-3 w-full cursor-not-allowed rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-subtle"
        >
          Connect
        </button>
      )}
    </div>
  )
}
