import 'server-only'
import { db } from './db'
import { listProjects, ensurePersonalProject, createProject } from './projects'
import { insertCanonicalTransaction } from './transactions'
import { normalizeMerchant } from './money'
import type { AccountProvider, AccountKind, RawTransaction } from './types'

// Lazy per-user demo seed. Idempotent: no-op if the user already has projects.
// Makes foundr.money instantly alive on first /dashboard load — a believable
// month of a founder running five things on one personal Amex.

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

interface Tmpl {
  daysAgo: number
  merchant: string
  desc: string
  cents: number // expense positive, income negative
  project: string // slug, or 'personal' for untagged
  category: string // category label
  account: string // account key
  pfc?: string
}

export async function ensureSeeded(ownerId: string): Promise<void> {
  const existing = await listProjects(ownerId)
  if (existing.some((p) => !p.is_personal)) return // already seeded

  const personal = await ensurePersonalProject(ownerId)

  // 1. Projects
  const projDefs = [
    { name: 'Inboxer', slug: 'inboxer', color: '#3b82f6', description: 'Newsletter SaaS — paid subscriptions.' },
    { name: 'Clipwise', slug: 'clipwise', color: '#10b981', description: 'AI video-clip generator.' },
    { name: 'DevPing', slug: 'devping', color: '#f59e0b', description: 'Uptime monitor CLI.' },
    { name: 'Tabsy', slug: 'tabsy', color: '#8b5cf6', description: 'Browser extension.' },
    { name: 'Consulting', slug: 'consulting', color: '#06b6d4', description: 'Fractional eng work.' },
  ]
  const projBySlug: Record<string, string> = { personal: personal.id }
  for (const p of projDefs) {
    const created = await createProject(ownerId, p)
    projBySlug[p.slug] = created.id
  }

  // 2. Categories (system) → id by label
  const { data: cats } = await db().from('categories').select('id, label').is('owner_id', null)
  const catByLabel: Record<string, string> = {}
  for (const c of (cats ?? []) as { id: string; label: string }[]) catByLabel[c.label] = c.id

  // 3. Financial accounts
  async function account(
    key: string,
    provider: AccountProvider,
    kind: AccountKind,
    display: string,
    last4?: string,
    stripeId?: string,
  ): Promise<string> {
    const { data, error } = await db()
      .from('financial_accounts')
      .insert({
        owner_id: ownerId,
        provider,
        kind,
        display_name: display,
        last4: last4 ?? null,
        stripe_account_id: stripeId ?? null,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const acc: Record<string, string> = {
    amex: await account('amex', 'plaid', 'card', 'Personal Amex', '1009'),
    stripeInboxer: await account('stripeInboxer', 'stripe', 'stripe_account', 'Stripe — Inboxer', undefined, 'acct_inboxer'),
    stripeClipwise: await account('stripeClipwise', 'stripe', 'stripe_account', 'Stripe — Clipwise', undefined, 'acct_clipwise'),
  }

  // 4. Transactions (one personal Amex; expense positive, income negative)
  const T: Tmpl[] = [
    // recurring AI / cloud (the moat) — tagged
    { daysAgo: 2, merchant: 'OpenAI', desc: 'API usage', cents: 4312, project: 'clipwise', category: 'AI & compute', account: 'amex', pfc: 'GENERAL_SERVICES' },
    { daysAgo: 3, merchant: 'Anthropic', desc: 'Claude API', cents: 8800, project: 'clipwise', category: 'AI & compute', account: 'amex', pfc: 'GENERAL_SERVICES' },
    { daysAgo: 5, merchant: 'OpenAI', desc: 'API usage', cents: 1240, project: 'inboxer', category: 'AI & compute', account: 'amex', pfc: 'GENERAL_SERVICES' },
    { daysAgo: 6, merchant: 'Vercel', desc: 'Pro plan', cents: 2000, project: 'inboxer', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 6, merchant: 'Vercel', desc: 'Pro plan', cents: 2000, project: 'devping', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 7, merchant: 'Supabase', desc: 'Pro org', cents: 2500, project: 'inboxer', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 9, merchant: 'Anthropic', desc: 'Claude API', cents: 2000, project: 'devping', category: 'AI & compute', account: 'amex' },
    { daysAgo: 11, merchant: 'Resend', desc: 'Email API', cents: 2000, project: 'inboxer', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 12, merchant: 'AWS', desc: 'us-east-1', cents: 1420, project: 'clipwise', category: 'AI & compute', account: 'amex' },
    { daysAgo: 13, merchant: 'Fly.io', desc: 'Compute', cents: 650, project: 'devping', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 14, merchant: 'Linear', desc: 'Seats', cents: 800, project: 'clipwise', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 15, merchant: 'GitHub', desc: 'Copilot + team', cents: 400, project: 'devping', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 18, merchant: 'Figma', desc: 'Pro seat', cents: 1500, project: 'tabsy', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 20, merchant: 'Adobe', desc: 'Creative Cloud', cents: 2299, project: 'tabsy', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 22, merchant: 'OpenAI', desc: 'API usage', cents: 3680, project: 'clipwise', category: 'AI & compute', account: 'amex' },
    { daysAgo: 24, merchant: 'Vercel', desc: 'Pro plan', cents: 2000, project: 'inboxer', category: 'Software & SaaS', account: 'amex' },
    // untagged (lands in Personal/Unallocated → the in-loop tagging demo)
    { daysAgo: 1, merchant: 'Cursor', desc: 'Pro subscription', cents: 2000, project: 'personal', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 4, merchant: 'Namecheap', desc: 'Domain renewal', cents: 1298, project: 'personal', category: 'Office expense', account: 'amex' },
    { daysAgo: 8, merchant: 'Cloudflare', desc: 'Workers paid', cents: 500, project: 'personal', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 10, merchant: 'Notion', desc: 'Plus plan', cents: 1000, project: 'personal', category: 'Software & SaaS', account: 'amex' },
    { daysAgo: 16, merchant: 'Blue Bottle Coffee', desc: 'Oat latte', cents: 650, project: 'personal', category: 'Meals', account: 'amex' },
    { daysAgo: 19, merchant: 'Apple', desc: 'iCloud+', cents: 99, project: 'personal', category: 'Office expense', account: 'amex' },
    { daysAgo: 25, merchant: 'PostHog', desc: 'Analytics', cents: 0, project: 'personal', category: 'Software & SaaS', account: 'amex' },
    // income — Stripe payouts + consulting (negative)
    { daysAgo: 3, merchant: 'Stripe', desc: 'Payout — Inboxer', cents: -42000, project: 'inboxer', category: 'Sales / revenue', account: 'stripeInboxer' },
    { daysAgo: 10, merchant: 'Stripe', desc: 'Payout — Inboxer', cents: -51000, project: 'inboxer', category: 'Sales / revenue', account: 'stripeInboxer' },
    { daysAgo: 6, merchant: 'Stripe', desc: 'Payout — Clipwise', cents: -18000, project: 'clipwise', category: 'Sales / revenue', account: 'stripeClipwise' },
    { daysAgo: 17, merchant: 'Stripe', desc: 'Payout — Clipwise', cents: -9500, project: 'clipwise', category: 'Sales / revenue', account: 'stripeClipwise' },
    { daysAgo: 21, merchant: 'Acme Corp', desc: 'Consulting invoice #14', cents: -250000, project: 'consulting', category: 'Consulting income', account: 'stripeInboxer' },
  ].filter((t) => t.cents !== 0)

  let i = 0
  for (const t of T) {
    const raw: RawTransaction = {
      external_id: `seed-${t.account}-${i++}`,
      source: t.account === 'amex' ? 'plaid' : 'stripe',
      account_ref: acc[t.account],
      amount_cents: t.cents,
      raw_amount_cents: t.account === 'amex' ? -t.cents : t.cents, // Plaid sign is inverted
      raw_sign_source: t.account === 'amex' ? 'plaid' : 'stripe',
      currency: 'usd',
      occurred_on: daysAgoISO(t.daysAgo),
      posted_on: daysAgoISO(t.daysAgo),
      merchant_hint: t.merchant,
      description: t.desc,
      pfc_primary: t.pfc ?? null,
    }
    await insertCanonicalTransaction(ownerId, raw, {
      projectId: projBySlug[t.project],
      categoryId: catByLabel[t.category] ?? null,
    })
  }

  // 5. Stripe subscriptions (multi-account MRR)
  const subs = [
    { acct: acc.stripeInboxer, project: projBySlug.inboxer, amount: 1900, interval: 'month' },
    { acct: acc.stripeInboxer, project: projBySlug.inboxer, amount: 1900, interval: 'month' },
    { acct: acc.stripeInboxer, project: projBySlug.inboxer, amount: 4900, interval: 'month' },
    { acct: acc.stripeInboxer, project: projBySlug.inboxer, amount: 9900, interval: 'year' },
    { acct: acc.stripeClipwise, project: projBySlug.clipwise, amount: 1500, interval: 'month' },
    { acct: acc.stripeClipwise, project: projBySlug.clipwise, amount: 1500, interval: 'month' },
    { acct: acc.stripeClipwise, project: projBySlug.clipwise, amount: 2900, interval: 'month' },
  ]
  await db().from('stripe_subscriptions').insert(
    subs.map((s, n) => ({
      owner_id: ownerId,
      financial_account_id: s.acct,
      stripe_subscription_id: `sub_seed_${n}`,
      status: 'active',
      interval: s.interval,
      interval_count: 1,
      amount_cents: s.amount,
      project_id: s.project,
    })),
  )

  // 6. Merchant rules (rules-first auto-tag demo)
  await db()
    .from('merchant_rules')
    .insert([
      { owner_id: ownerId, merchant_pattern: normalizeMerchant('Resend'), project_id: projBySlug.inboxer, category_id: catByLabel['Software & SaaS'], source: 'promoted' },
      { owner_id: ownerId, merchant_pattern: normalizeMerchant('Supabase'), project_id: projBySlug.inboxer, category_id: catByLabel['Software & SaaS'], source: 'promoted' },
      { owner_id: ownerId, merchant_pattern: normalizeMerchant('Figma'), project_id: projBySlug.tabsy, category_id: catByLabel['Software & SaaS'], source: 'manual' },
    ])

  // 7. External project crosswalk (pair once → auto-tag forever)
  await db()
    .from('external_project_map')
    .insert([
      { owner_id: ownerId, provider: 'openai', external_id: 'proj_clipwise', project_id: projBySlug.clipwise },
      { owner_id: ownerId, provider: 'anthropic', external_id: 'wrkspc_clipwise', project_id: projBySlug.clipwise },
      { owner_id: ownerId, provider: 'vercel', external_id: 'prj_inboxer', project_id: projBySlug.inboxer },
    ])

  // 8. Provider invoices (the moat — first-class line items)
  await db()
    .from('provider_invoices')
    .insert([
      {
        owner_id: ownerId,
        provider: 'openai',
        external_invoice_id: 'in_openai_demo',
        period_start: daysAgoISO(32),
        period_end: daysAgoISO(2),
        total_cents: 4312,
        external_project_ref: 'proj_clipwise',
        line_items: [{ description: 'gpt-4o input', amount_cents: 2890 }, { description: 'gpt-4o output', amount_cents: 1422 }],
      },
      {
        owner_id: ownerId,
        provider: 'vercel',
        external_invoice_id: 'in_vercel_demo',
        period_start: daysAgoISO(32),
        period_end: daysAgoISO(2),
        total_cents: 2000,
        external_project_ref: 'prj_inboxer',
        line_items: [{ description: 'Pro seat', amount_cents: 2000 }],
      },
    ])
}
