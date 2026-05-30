# foundr.money v1 — Spec & Implementation Plan

> Locked v1 decisions. Grounded in `docs/research/2026-05-30-foundr-money-research-dossier.md`.
> Product: **"Agent-first budgeting that tracks every project's burn."**
> ICP: the founder running 3–10 side projects on ONE personal card with NO entity.

## 0. The five angles (the product's spine)

1. **Project-first, not category-first** — `project` is the primary axis; category (Schedule C) is secondary, on the split.
2. **Built for the 3–10 micro-startup founder** — Ramp/Brex/QBO can't serve them (verified gates below).
3. **Agentic tagging via MCP** — tag in the loop you make decisions (Claude Code / Cursor), not a dashboard.
4. **LLM/cloud-provider native** — OpenAI / Anthropic / Vercel / Supabase / Cursor as first-class line items.
5. **No entity required** — personal cards/bank via Plaid; no card issuance ⇒ no KYB gate. Tax-aware export at year-end.

## 1. Locked architecture decisions

- **Auth:** Clerk (reused dev instance keys). **Data access is server-side only, via the Supabase service role, every query scoped by `owner_id = clerkUserId`.** RLS is enabled as defense-in-depth (deny-by-default to `anon`), but app correctness comes from app-layer owner scoping. This deliberately avoids the Clerk↔Supabase native-JWT integration config for v1. The MCP server derives `owner_id` from the bearer key → founder mapping, never from tool args.
- **Money:** integer **cents (`bigint`)**, explicit currency. **House sign convention: expense = positive, income = negative.** Normalize every source on ingest; keep `raw_amount_cents` + `raw_sign_source` to re-derive. Never float math on mixed-unit inputs.
- **Ledger:** single signed `transactions` table + **mandatory `transaction_allocations` (splits)** table — even for the 1:1 case ("one Amex across 5 projects" is the core use case). Per-project P&L is a rollup over allocations, never a tag scan. A system **"Personal / Unallocated"** project per owner absorbs remainders so a txn is never partially-allocated-in-violation. A deferrable trigger enforces `SUM(allocations) = txn.amount`.
- **Categories:** secondary axis on the split; seeded from the Schedule C Part II lines.
- **MCP server:** `/api/mcp/money`, MCP Streamable HTTP, **stateless** (`sessionIdGenerator: undefined`), `@modelcontextprotocol/sdk` low-level + `WebStandardStreamableHTTPServerTransport` (pattern cloned from foundr.world `/api/mcp/backlog`). **Static API-key bearer (free tier) is REAL in v1; OAuth 2.1 Pro flow is stubbed/feature-flagged.** Five tools, audit-logged.
- **Classifier:** rules-first (`merchant_rules`, zero LLM cost) → **Haiku 4.5** LLM fallback via the Vercel **AI Gateway**, model id **`anthropic/claude-haiku-4.5`** (PERIOD — the hyphen form 404s). `generateObject` with a Zod schema; `confidence` + `__needs_review__` abstain are first-class; `confidence < 0.7` or abstain → the in-loop tag. Confirms promote to deterministic rules; overrides become few-shot examples.
- **Ingestion:** one canonical `RawTransaction`; every source is an adapter. Plaid is **Sandbox-real** (mock the bank, not the adapter — real link-token/exchange/webhook-verify/cursor-sync). **One Stripe-receipt parser** covers OpenAI + Anthropic + Cursor emailed receipts. **Vercel FOCUS API pull** is real (native `ProjectId`, only needs a team token). **Reconcile provider-invoice ⇄ paying card-charge** (amount+merchant+date window) or per-project AI/cloud burn doubles. Multi-Stripe MRR = one restricted key per account, normalized to monthly, summed.
- **Brand:** foundr.company **blue `#3b82f6` on white** (NOT the host repo's sage). Poppins (display) / Roboto (body) / Inconsolata (mono labels). Tokens per dossier §7.
- **Pricing:** $19/mo Solo, $49/mo Pro. Tax-aware export (Schedule C lines + 1099-NEC candidate list ≥ $600) gated to Pro. **Copy: "data prep, not tax advice."**
- **Marketing claims:** use the verified incumbent quotes (Ramp "not accepting individuals, sole proprietors…"; Brex $50K + EIN; QBO Solopreneur Schedule-C-only). **DROP the "$200K Solopreneur ceiling"** — unverified.

## 2. Routes

| Path | Render | Purpose |
|---|---|---|
| `/` | Static | Marketing landing — 5 angles, 5 pains, incumbent gaps, pricing teaser |
| `/pricing` | Static | $19 Solo / $49 Pro |
| `/sign-in`, `/sign-up` | PPR | Clerk (server shell + client form + connection() + loading.tsx) |
| `/dashboard` | Dynamic (auth) | Portfolio P&L — per-project burn across all projects |
| `/dashboard/projects/[slug]` | Dynamic (auth) | Single-project P&L + its transactions |
| `/dashboard/transactions` | Dynamic (auth) | Transaction feed + agentic tagging/splits (optimistic) |
| `/dashboard/connect` | Dynamic (auth) | Connect Plaid sandbox + Vercel/Stripe + MCP key + provider crosswalk |
| `/api/mcp/money` | Route handler | MCP server (static-key bearer) |
| `/api/plaid/link-token` · `/exchange` · `/webhook` | Route handlers | Plaid (webhook is public/unauth, JWT-verified) |
| `/api/export/schedule-c` | Route handler | Pro tax-aware CSV export |

## 3. Data access layer (`src/lib/money/`)

- `db.ts` — service-role Supabase client (server-only).
- `owner.ts` — `requireOwnerId()` = Clerk `auth()` userId (throws if unauth); MCP path injects owner from bearer.
- `types.ts` — canonical row types incl. `RawTransaction`, `Project`, `Allocation`, P&L rollup.
- `money.ts` — cents↔display formatting, sign helpers.
- `constants.ts` — `CLASSIFIER_MODEL = 'anthropic/claude-haiku-4.5'`, Schedule C lines, brand project colors, pricing.
- `projects.ts`, `transactions.ts`, `allocations.ts`, `pnl.ts` — query/mutation helpers (all owner-scoped).
- `classifier/` — rules + LLM cascade.
- `ingest/` — `plaid.ts`, `stripe-receipt.ts`, `vercel-focus.ts`, `reconcile.ts`, canonical writer.

## 4. Build order

**Foundation (sequential, owner-driven):** deps+install · brand tokens+fonts · DB migration (apply+verify) · core lib (`src/lib/money/*` skeleton + constants + types + db/owner/money) · seed data (apply) · app shell + nav.

**Parallel slices (implementation workflow):**
- **S1 Landing + Pricing** — brand-native marketing (`/`, `/pricing`, components).
- **S2 Portfolio + project P&L** — `/dashboard`, `/dashboard/projects/[slug]`, charts (CSS/SVG, no chart lib).
- **S3 Transactions + tagging UI** — `/dashboard/transactions`, split editor, optimistic commit pattern.
- **S4 MCP server** — `/api/mcp/money` + `src/lib/mcp/` (5 tools, static-key auth, audit) + `/dashboard/connect` MCP-key section.
- **S5 Classifier** — `src/lib/money/classifier/` (rules → Haiku-4.5 generateObject + feedback).
- **S6 Ingestion** — Plaid sandbox routes + Stripe-receipt parser + Vercel FOCUS + reconcile + canonical writer.
- **S7 Tax export** — `/api/export/schedule-c` + Pro gating.

**Integration:** `pnpm build` green · `scripts/snap.mjs` screenshots (read PNGs) · apply final migrations · deploy to Vercel prod · live smoke.

## 5. Out of scope for v1 (documented, not silently dropped)
- Real production Plaid bank OAuth (sandbox only); OpenAI/Anthropic admin-key Costs pulls (mocked seed + Stripe-receipt fallback is the real path); pgvector similarity stage; full OAuth Pro MCP flow; AWS Cost Explorer (wave 2); real billing/Stripe checkout for the SaaS subscription itself.
