// Shared constants. Client-safe (no server imports) — importable anywhere.

/** AI Gateway model id for transaction classification.
 *  NOTE: PERIOD, not hyphen — `anthropic/claude-haiku-4-5` 404s. */
export const CLASSIFIER_MODEL = 'anthropic/claude-haiku-4.5'

/** Confidence below this routes a transaction to in-loop human/MCP tagging. */
export const CONFIDENCE_THRESHOLD = 0.7

/** Brand-friendly chart palette for projects. */
export const PROJECT_COLORS = [
  '#3b82f6', // blue (accent)
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#84cc16', // lime
  '#ec4899', // pink
] as const

export const MCP_SCOPES = {
  read: 'mcp:money:read',
  write: 'mcp:money:write',
} as const

export const PRICING = {
  solo: {
    name: 'Solo',
    price: 19,
    cadence: '/mo',
    tagline: 'One founder, a handful of projects.',
    features: [
      'Up to 3 connected accounts',
      'Unlimited projects & per-project P&L',
      'Agentic tagging via MCP (free in Claude Code & Cursor)',
      'AI/cloud invoice ingestion (OpenAI, Anthropic, Vercel, Supabase)',
      'Rules-first + AI auto-tagging',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49,
    cadence: '/mo',
    tagline: 'For the portfolio that’s starting to graduate.',
    features: [
      'Unlimited connected accounts',
      'Multi-Stripe MRR rollup',
      'Tax-aware export — Schedule C lines + 1099-NEC candidates',
      'OAuth MCP for shared/team agents',
      'Priority invoice parsers',
    ],
  },
} as const

export const PRODUCT = {
  name: 'foundr.money',
  tagline: 'Agent-first budgeting that tracks every project’s burn.',
  oneLiner:
    'Per-project P&L for the founder running five things on one card. No entity required.',
} as const
