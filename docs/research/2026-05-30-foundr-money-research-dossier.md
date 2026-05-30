# foundr.money — Research Dossier

> Single source of truth for the product spec + implementation plan.
> Date: 2026-05-30 · Lead architect: Dante Perea · Status: pre-spec
> Product one-liner: **"Agent-first budgeting that tracks every project's burn."**
> ICP: the 3–10-person micro-startup founder running several side projects on ONE personal card with NO entity.

---

## 1. Executive Summary — what we now know that sharpens the build

Seven research passes converge on one conclusion: **the wedge is real, primary-source-verifiable, and buildable end-to-end on the exact stack this monorepo already runs.** The sharpening:

1. **The "no entity" wedge is a hard, quotable exclusion — not a soft underserve.** Ramp's own support docs say it is "not accepting individuals, sole proprietors, and other types of unregistered businesses." Brex requires a US EIN + valid US incorporation (+ ~$50K cash if funded). These gates are **structural KYB/AML obligations**, not policy choices incumbents can relax — because incumbents *issue a card*. foundr.money **issues nothing**; it is software over Plaid-linked personal cards, so it has no KYB obligation at all. Make "we don't issue a card, so we don't need your EIN" an explicit product principle.

2. **One claim must be dropped: the "$200K Solopreneur ceiling."** It is not in any primary Intuit doc and is falsifiable. Replace with the *stronger, verified* capability boundary: QuickBooks Solopreneur is **Schedule-C-only** — no balance sheet, no double-entry, no custom chart of accounts, no Projects/per-project P&L, and it **cannot file for an S-corp**. Per-project P&L in the QBO line only exists at **Plus ($115/mo)** and only **within one legal entity**, billed **per company** — so 5 incorporated projects = ~$495–575/mo, and unincorporated projects are impossible at any price.

3. **The moat is precise and unoccupied: AI/cloud invoice ingestion with native project granularity.** Zero surveyed incumbent (Ramp, Brex, QBO, Expensify, Navan, Zoho) ingests OpenAI/Anthropic/Vercel/Supabase/Cursor as first-class line items. And four of those providers expose **native project/workspace/org-key dimensions** that map ~1:1 to a foundr.money project: OpenAI `project_id`, Anthropic `workspace_id`, Vercel `Tags.ProjectId`. This is auto-tag-without-asking for the exact spend this buyer concentrates.

4. **The MCP tagging server is a clone-job, not a research project.** This repo already ships a production remote MCP server at `/api/mcp/backlog` with OAuth 2.1 Resource Server semantics (RFC 9728 PRM, RFC 8707 audience binding), a dual auth path (audience-bound OAuth bearer + static API-key fallback), per-call audit logging, and the `cacheComponents`-compatible stateless Streamable HTTP transport. foundr.money's tagging server reuses this plumbing verbatim. CAC≈0 distribution inside Claude Code / Cursor is real today.

5. **A model-ID bug in our own CLAUDE.md must be fixed before we build the classifier.** The gateway model ID is `anthropic/claude-haiku-4.5` (**period**, verified live against `ai-gateway.vercel.sh/v1/models`). The string `anthropic/claude-haiku-4-5` (hyphen) referenced elsewhere **does not exist and will 404.** Haiku 4.5 is $1/$5 per M in/out tokens — the right cheap classifier.

6. **The data model is project-first by construction.** A single signed `transactions` ledger + a mandatory `transaction_allocations` (splits) table — even for the 1:1 case — because "one Amex across 5 projects" *is* the core use case. Per-project P&L is a rollup over allocations, never a tag scan. Plaid's amount sign is **inverted** (expenses positive, income negative) and must be normalized on ingest. Brand: foundr.money matches **foundr.company's blue (#3b82f6) on white**, NOT the host repo's sage.

7. **The graduation path is the upsell, not a churn risk.** When a winning side project incorporates (S-corp/1099/Schedule C), Solopreneur can't follow it and QBO forces a from-scratch per-entity rebuild. foundr.money's $49 Pro tax-aware export (Schedule C lines + 1099-NEC candidate list) captures that moment without forcing the founder off the product prematurely.

---

## 2. Incumbent Gap Table — verified thresholds + the exact vulnerability each angle exploits

| Incumbent | Verified gate (primary source) | What it CANNOT do | foundr.money angle exploited |
|---|---|---|---|
| **Brex** | US EIN + valid US incorporation + US address required; **~$50K minimum cash** (funded startups), >$400K/mo revenue (mid-market), >$1M/yr (commercial). No personal-guarantee path without entity. [brex.com/support] | Serve a sole proprietor or unincorporated side project — categorically ineligible before underwriting. | **05 No entity required.** Target user is gated out at the door. **02 Built for the micro-startup.** |
| **Ramp** | Must be "corporation, limited liability company, or LP"; **"not accepting individuals, sole proprietors, and other types of unregistered businesses."** EIN **cannot be waived**. **$25K** in a US business bank account. Rejects PO boxes / virtual offices / consumer email. [support.ramp.com] | Same structural exclusion. (Note: $25K was reportedly lowered from $75K — the *cash number* is movable; the **EIN/entity gate is the durable wedge.**) | **05 No entity.** **02 Micro-startup.** Quote the "not accepting individuals…" line verbatim. |
| **QuickBooks Solopreneur** | **Schedule-C-only** (sole prop / single-member LLC); **does NOT support S-corp/partnership**; single-entry, **no balance sheet, no custom CoA, no class/location, no Projects.** [intuit.com, updated 2026-03-26] | Per-project P&L; serve an S-corp; consolidate a portfolio. | **01 Project-first.** **02 Micro-startup graduation.** ⚠️ Drop the "$200K ceiling"; use the capability boundary instead. |
| **QuickBooks Plus/Advanced** | Per-project profitability gated to **Plus $115/mo** (Advanced $275); **one paid subscription PER legal entity** — "no way to share one subscription across multiple entities." [intuit.com/pricing, kantivo.app] | Cross-project P&L across a **zero-entity** portfolio at any price. 5 projects = ~$495–575/mo + 5 incorporations. | **01 Project-first P&L.** **Pricing:** "one card, five projects, one subscription" vs ~$575/mo. |
| **Expensify / Invoicera / Navan / Zoho** | "Project" exists only as a **billable tag** layered on a category-first model, built for client/agency billing. [invoicera.com, emburse.com] | Portfolio-level per-project P&L for ONE unincorporated person. | **01 Project-first** as the *primitive* (schema axis), not a tag. Sharpen UX so project is clearly the spine. |
| **ALL incumbents** | None ingest OpenAI/Anthropic/Vercel/Supabase/Cursor as first-class line items; none expose tagging via MCP. | First-class AI/cloud line items; tagging in the agent loop. | **04 LLM/cloud-native moat.** **03 Agentic tagging via MCP.** Green-field. |

**Verified KYB rationale (load-bearing for the durable wedge):** Ramp/Brex EIN requirements are "required by law to verify the identity of key individuals… and confirm business ownership, structure" — i.e. structural, not relaxable. foundr.money sidesteps this entirely by linking **personal** accounts via Plaid consumer auth (no card issuance ⇒ no KYB).

**Claims policy for marketing/copy:**
- ✅ Use verbatim: Ramp "not accepting individuals, sole proprietors…"; Brex "$50K minimum cash (if you've raised funding)"; Ramp "$25K… US business bank account"; "Solopreneur is Schedule-C-only, no S-corp, no balance sheet, no projects."
- ❌ Do NOT use: "$200K Solopreneur income ceiling" (unverified/inaccurate). Restate as capability boundary.
- ⚠️ Pin all incumbent claims to the live support page + re-verify periodically (Capital One/Brex acquisition rumor is *unverified*; Ramp cash minimums move down over time — anchor on the **entity gate**, not the dollar figure).

---

## 3. Recommended Postgres Data Model (project-first, Clerk multi-tenant RLS)

**Design stance:** single signed ledger (NOT double-entry) + a **mandatory allocations/splits table** + project as the primary axis + Schedule C category as the secondary axis. All money as **integer cents (`bigint`)** with explicit currency — never floats. Every table carries `owner_id text` for RLS.

### 3.1 RLS approach (Clerk native integration)

Use the **Supabase native Clerk integration** (the JWT-template path was deprecated 2025-04-01). Every table:

```sql
-- on every table:
owner_id text not null default (auth.jwt()->>'sub'),
-- enable + per-operation policies:
alter table <t> enable row level security;
create policy "<t>_select" on <t> for select to authenticated
  using ((select auth.jwt()->>'sub') = owner_id);
create policy "<t>_modify" on <t> for all to authenticated
  using ((select auth.jwt()->>'sub') = owner_id)
  with check ((select auth.jwt()->>'sub') = owner_id);
```

Client passes `accessToken: async () => session?.getToken() ?? null`; server passes `async () => (await auth()).getToken()`. End-users carry the `authenticated` role claim. **Future team/org workspaces:** swap the `owner_id` comparison for a `requesting_owner_id()` helper that prefers the JWT `o` (org id) and falls back to `sub` — design `owner_id` so this swap is non-breaking.

### 3.2 Tables

**`projects`** — the primary axis
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | text | RLS, default `auth.jwt()->>'sub'` |
| name, slug | text | slug unique per owner |
| status | enum `active\|archived` | |
| is_personal | bool | a system **"Personal/Unallocated"** project exists per owner so every txn is fully allocated |
| color | text | brand-token color for charts |
| created_at | timestamptz | |

**`financial_accounts`** — abstracts every money source
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | text | |
| provider | enum `plaid\|stripe\|manual\|openai\|anthropic\|vercel\|supabase\|cursor` | |
| kind | enum `card\|bank\|stripe_account\|provider_invoice` | |
| display_name, last4 | text | last4 nullable |
| currency | text | default `usd` |
| plaid_item_id, plaid_account_id | text | nullable |
| stripe_account_id | text | nullable; **one row per Stripe account** ⇒ multi-account MRR |
| credential_ref | text | **points to encrypted secret store — NEVER raw token/key in a plaintext column** |
| sync_cursor | text | Plaid `next_cursor` |
| last_synced_at, status | | detect `ITEM_LOGIN_REQUIRED` |

**`transactions`** — single signed ledger
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | text | |
| financial_account_id | uuid fk | |
| external_id | text | provider txn id; **`unique(financial_account_id, external_id)`** for idempotent upsert |
| posted_at | date | use Plaid `date`; keep `authorized_date` too |
| amount_cents | bigint | **house convention: expense = positive** (or pick one and document it) |
| raw_amount_cents | bigint | as the source reported it |
| raw_sign_source | text | e.g. `'plaid'` — lets us re-derive if a sign bug is found |
| direction | enum `income\|expense` | derived |
| currency | text | |
| merchant_name, description | text | enriched + raw descriptor |
| plaid_pfc_primary, plaid_pfc_detailed, plaid_pfc_confidence | text | **category HINT only — not the project axis** |
| pending, pending_transaction_id | bool/text | |
| created_at | timestamptz | |

**`transaction_allocations`** — the splits table (the project link, **mandatory even for 1:1**)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| transaction_id | uuid fk | |
| project_id | uuid fk | |
| owner_id | text | |
| amount_cents | bigint | |
| pct | numeric(7,4) | nullable (percent-entry mode) |
| category_id | uuid fk | **the secondary Schedule C axis lives on the SPLIT** — same charge can be (Proj A / L18 Office) + (Proj B / L22 Supplies) |
| note | text | |

> **Sum-to-total invariant:** a **deferrable constraint trigger** enforces `SUM(allocations.amount_cents) per txn = transactions.amount_cents`. The system **"Personal/Unallocated"** project absorbs any remainder so a partially-allocated txn is never in violation mid-edit (critical given the repo's optimistic-mutation pattern — never reject an otherwise-valid write because allocation is incomplete).

**`categories`** — secondary axis, seeded from Schedule C
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | text | nullable (null = system default) |
| label | text | |
| schedule_c_line | text | e.g. `L18`, `L22`, `L11`, `L17` |
| is_income | bool | |

Seed the **20 Schedule C Part II lines** as system rows: L8 Advertising, L9 Car/truck, L10 Commissions, L11 Contract labor, L12 Depletion, L13 Depreciation/§179, L14 Employee benefits, L15 Insurance, L16a/b Interest, L17 Legal/professional, L18 Office expense, L19 Pension, L20a/b Rent/lease, L21 Repairs, L22 Supplies, L23 Taxes/licenses, L24a Travel, L24b Meals, L25 Utilities, L26 Wages, L27a/b Other — plus an income category set.

**`plaid_items`** — per-Item sync state (subset of `financial_accounts` concerns, kept separate for the access-token lifecycle)
| col | type | notes |
|---|---|---|
| item_id | text pk | |
| owner_id | text | |
| access_token | text | **encrypted at rest** (or `credential_ref` to a secret store) |
| cursor | text | only state incremental sync needs |
| institution_name, last_synced_at, status | | |

**`recurring_streams`** — subscription detection (Plaid `/transactions/recurring/get`)
`id, owner_id, financial_account_id, plaid_stream_id, merchant_name, category, average_amount_cents, frequency, last_amount_cents, last_date, is_active, default_project_id, default_category_id`.
`default_project_id` lets a known subscription (e.g. OpenAI) auto-allocate new occurrences via MCP **without re-asking**.

**`provider_invoices`** — the moat
`id, owner_id, financial_account_id, provider, external_invoice_id, period_start, period_end, total_cents, currency, line_items jsonb, source_blob_url, parsed_at, external_project_ref`.
Parser emits `transactions` + suggested `allocations` the founder confirms in-loop. **Reconcile against the matching card charge** (amount + merchant + date window) to avoid double-counting (see §5.5).

**`stripe_subscriptions`** — multi-account MRR snapshot
`id, owner_id, financial_account_id, stripe_subscription_id, status, interval, interval_count, amount_cents, currency, discount_monthly_cents, project_id`.

**`external_project_map`** — crosswalk (provider-native project ⇄ foundr project)
`id, owner_id, provider, external_id (OpenAI project_id / Anthropic workspace_id / Vercel ProjectId), project_id, created_at`. Pair once at onboarding ⇒ every future API pull auto-tags with no decision.

**`merchant_rules`** — deterministic tagging (rules-first classifier, §6)
`id, owner_id, merchant_pattern (normalized), project_id, category_id, created_at, source enum(manual\|promoted)`.

**`tagging_feedback`** — the MCP learning loop
`id, owner_id, transaction_id, suggested_project_id, confirmed_project_id, was_override bool, confidence numeric, created_at`. Confirms promote to `merchant_rules`; overrides become few-shot examples.

**`monthly_project_pnl`** — materialized rollup (perf)
`owner_id, project_id, month date, income_cents, expense_cents, net_cents, mrr_cents`. Refreshed nightly + on mutation. Burn = `expense_cents`; net = income − expense.

### 3.3 Cache integration (cacheComponents is ON)

Expose P&L rollups via a `'use cache'` server loader tagged `project:<id>:pnl:<month>`; call `revalidateTag('project:<id>:pnl:<month>', 'max')` on allocation mutations — mirror the existing room-layout cache pattern. **Per the May 2026 backlog saga:** for the hot optimistic tagging path over a `'use cache: private'` list (untagged-transaction feed), the mutation Server Action does **NO** cache refresh — it returns the authoritative allocation row and the client commits it into the `useOptimistic` base. Do not re-add `revalidateTag`/`updateTag` to that hot action.

---

## 4. The MCP Billing Primitive (the moat — opinionated)

**Build path:** clone the repo's existing low-level `@modelcontextprotocol/sdk` (`^1.29.0`, safe — pre-1.26 has a CVE) + `WebStandardStreamableHTTPServerTransport` pattern. **Do NOT adopt Vercel's `mcp-handler`** — it reimplements the same RFC 9728 endpoints we already have battle-tested, and its quickstart targets zod ^3 while this repo runs zod ^4 (peer-dep risk).

**Transport:** Streamable HTTP, **stateless** (`sessionIdGenerator: undefined`) — a fresh `Server` + transport per request, the correct serverless pattern. SSE is deprecated; no Redis. Deploy on Fluid compute (Vercel default); set a generous `maxDuration` for `project_pnl` aggregations.

**Route:** `src/app/api/mcp/money/route.ts` mirroring `src/app/api/mcp/backlog/route.ts`:
```
await connection()  →  validateBearer(req, { audience: 'money' })
  →  createMoneyMcpServer(ctx)
  →  new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  →  server.connect  →  withCors(await transport.handleRequest(req))
```
Export `POST`/`GET` + `OPTIONS = corsPreflightResponse`. The webhook-style route is unauthenticated only for Plaid; **MCP route is always bearer-gated.**

### 4.1 Auth — ship BOTH modes day one

1. **Free-tier static API key (CAC≈0 viral path).** New table `money_agent_keys` (`key_hash sha256, founder_id, status, last_used_at`) cloned from `mcp_agent_keys`; fallback validator mirrors `verifyMobileFounderBearer`. User adds:
   ```bash
   claude mcp add --transport http foundr-money https://www.foundr.money/api/mcp \
     --header "Authorization: Bearer fm_..."
   ```
2. **OAuth 2.1 browser flow (Pro).** Reuse the entire `/api/ee/oauth/*` AS surface + `/.well-known/oauth-authorization-server` + add `/.well-known/oauth-protected-resource/api/mcp/money` advertising scope **`mcp:money`**. DCR + PKCE already work, so Claude Code/Cursor self-register with zero manual app config.

**Tenant isolation (load-bearing):** add `getMcpMoneyAudienceFromRequest(req) = `${getOauthBaseFromRequest(req)}/api/mcp/money`` and extend `validateBearer`'s audience switch (RFC 8707). `expectedAudience` is derived from the **live request host** (behind Vercel's trusted proxy headers — never parse `Host` from arbitrary client headers) and compared to the stored `token.audience`; a token minted for founder A cannot be replayed elsewhere.

**Scopes:** issue `mcp:money:read` vs `mcp:money:write` separately so the free tier can be read-mostly and `project_pnl`/`list_untagged` don't require write. **Never pass the foundr.money token through to any upstream API** (spec forbids; confused-deputy risk).

**Audit:** keep the `logMcpCall` wrapper (`server:'foundr-money', founderId, toolName, requestPayload, actChain, latencyMs, status`) — the `act_chain` (who/which agent/which session tagged a txn) is a **product feature** (audit-ready Schedule C / 1099 provenance), not just observability.

**Claude Code v2 Tool Search note:** only tool *names* load at session start; schemas fetched on demand. Write a **<2KB `server-instructions`** field + crisp per-tool descriptions ("Requires OAuth scope mcp:money" + "when NOT to use") so the agent reaches for `tag_transaction` at the decision moment. Annotate `project_pnl` with `_meta['anthropic/maxResultSizeChars']` if output is large. **Failure mode:** an invalid static key makes Claude Code report FAILED (no OAuth fallback) — keep the two connection methods cleanly separated in docs + clean key regeneration in the dashboard.

### 4.2 Concrete tool surface (ship these five; each = one file under `src/lib/mcp/tools/money/`)

| Tool | Purpose | Key args | Annotations / scope |
|---|---|---|---|
| **`tag_transaction`** | Allocate a transaction to one or more projects, in the loop the founder is already in. | `txn_id`, `project` (slug or id), `amount_cents?` (for splits; omit ⇒ full amount), `category?` (Schedule C line), `confidence?`, `note?` | `destructiveHint:false, idempotentHint:true`; `mcp:money:write` |
| **`list_untagged`** | Surface transactions still in Personal/Unallocated so the agent/founder can clear them. | `since?`, `limit?` (default 50), `account?` | `readOnlyHint:true`; `mcp:money:read` |
| **`create_project`** | Spin up a new project (dedup on slug). | `name`, `slug?`, `color?` | `idempotentHint:true` (DUPLICATE = success); `mcp:money:write` |
| **`project_pnl`** | Per-project P&L / burn for a period — the answer to "which project caused that bill?" | `project`, `period?` (month/quarter/ytd) | `readOnlyHint:true`, `_meta['anthropic/maxResultSizeChars']`; `mcp:money:read` |
| **`log_expense`** | Manually record spend not yet synced (cash, a bill the agent just incurred). | `amount`, `project`, `vendor`, `occurred_at?`, `category?` | `idempotentHint:false`; `mcp:money:write` |

**Tool-shape contract (port verbatim from `backlog/note.ts`):** `{ name, description (verbose, includes scope + when-NOT-to-use), inputSchema (Zod), jsonSchema (hand-written in `money/index.ts`), annotations, async handler(input, ctx) }`. Handler calls `requireScope(ctx.scopes, SCOPE)` first, then DB ops scoped to `founderId` from the bearer — **never from tool args** (prompt-injection mitigation; lean on `src/lib/mcp/moderation/prompt-injection.ts`). All mutations idempotent + reversible.

**Onboarding copy = the one-liner.** A `/money/connect` dashboard page shows the exact `claude mcp add …` command (one-click copy) + the Cursor `.cursor/mcp.json` snippet (`{ mcpServers: { "foundr-money": { url, headers: { Authorization } } } }`, recommend `${env:VAR}` for the key). The buyer lives in the terminal — meet them there.

---

## 5. Ingestion Architecture (source-agnostic adapters)

### 5.1 Canonical row + FOCUS-shaped line items

Define ONE internal `RawTransaction`:
```
external_id, source enum('plaid'|'csv'|'invoice'),
account_ref, amount_cents (NORMALIZED: + = expense),
currency, occurred_on, posted_on, raw_descriptor,
merchant_hint, category_hint (nullable), project_id (nullable until tagged),
pending, metadata jsonb
```
Each source is an **adapter** mapping INTO this type. Plaid is one adapter; the CSV importer and the invoice parsers are siblings. **The project axis + MCP tagging operate on the canonical row, never on Plaid-specific fields.** Adopt **FOCUS v1.3** (ratified 2025-12-04) as the internal normalized line-item shape for invoices — Vercel emits it verbatim (zero transform), and any FOCUS-emitting provider drops in. Relevant columns: `BilledCost, EffectiveCost, Currency, ChargeCategory, ServiceName, ServiceCategory, ChargePeriodStart/End, ConsumedQuantity/Unit, Tags` (carries provider project).

**Idempotent writer:** `/transactions/sync` is delta-based (added/modified/removed) ⇒ UPSERT on added+modified, soft/hard-delete on `removed[].transaction_id`. Natural dedupe key = `unique(source, external_id)`. Self-healing reconciliation; matches the CSV importer's upsert-by-external-id semantics.

### 5.2 Plaid adapter

**Environments:** only **Sandbox** (free, no approval) and **Production** exist — Development was decommissioned 2024-06-20. Production go-live is **self-serve**: Limited Production (≤200 calls/product), Trial (10 free live Items), Pay-as-you-Go (no commitment) → Growth (12-mo). **No sales call, no signed contract.** Confirm only the `transactions` product is enabled (avoid Auth/Identity surcharges).

**Sign convention (critical):** Plaid `amount` is **positive = outflow/expense, negative = inflow/refund** — the opposite of intuition. Normalize on ingest; keep `raw_amount_cents` + `raw_sign_source` to re-derive.

**`personal_finance_category`** (16 primary / 104 detailed, PFCv1; PFCv2 default for accounts enabled after 2025-12-03) is a **category-axis hint only** — store `primary/detailed/confidence_level` to *seed* suggestions; the project is set via the MCP loop. Request `options.personal_finance_category_version:'v2'` explicitly and store the version per row.

**Three server Route Handlers** under `app/api/plaid/` (all dynamic via `auth()`/body — **no `export const dynamic`/`runtime`** under cacheComponents):
- `POST /api/plaid/link-token` → `/link/token/create` with `products:['transactions']`, `webhook:/api/plaid/webhook`, `user.client_user_id = founder id` (basic single-Item Transactions app keeps the legacy `client_user_id` — the Dec-10-2025 `/user/create` requirement is **only** for Protect/Multi-Item Link/CRA; ⚠️ if we later link multiple banks per founder under one identity = Multi-Item Link, that *would* trigger `/user/create` — verify before architecting multi-bank-per-founder).
- `POST /api/plaid/exchange` → `/item/public_token/exchange`, persist Item, kick first sync.
- `POST /api/plaid/webhook` → **public, unauthenticated** (exempt from Clerk proxy matcher); security boundary is JWT verification.

**Connect-bank UI:** a `'use client'` component using `usePlaidLink({ token, onSuccess, … })` (client-only hook, requires `window`) — `link_token` fetched from a server route first; gate the button on `ready`. Mirror the existing Connect-GitHub/Composio connector pattern.

**Webhook verification (sharp edges — get these exact):** read **raw body** (`req.text()`) BEFORE `JSON.parse` (whitespace-sensitive) → decode `Plaid-Verification` JWT (assert `alg=ES256`, read `kid`) → `GET /webhook_verification_key/get` (cache JWK by kid) → verify signature → assert `iat` within **5 minutes** → SHA-256 raw body vs `request_body_sha256` with **constant-time compare**. **Only then** enqueue the sync; **return 200 fast, process async** (Plaid retries on non-2xx ⇒ duplicate triggers). On `SYNC_UPDATES_AVAILABLE`, run the cursor loop (`while has_more` → UPSERT batches → persist final `next_cursor`); on `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION`, restart from last saved cursor. Ignore legacy `INITIAL_UPDATE`/`HISTORICAL_UPDATE`/`DEFAULT_UPDATE` (those are `/transactions/get` only).

**Lifecycle / cost:** Plaid bills a **per-Item monthly subscription** as long as a valid `access_token` exists. **"Disconnect bank" MUST call `/item/remove`** (stops billing immediately). Detect `ITEM_LOGIN_REQUIRED`/disconnected Items and remove for churned users. **Pricing tiers should bound connectable Items** (e.g. Solo = 2–3, Pro = unlimited). ⚠️ Plaid list pricing is undisclosed/negotiated — **validate the per-Item dollar figure against a real dashboard quote before committing $19/$49.** Never store `access_token` in the client bundle; encrypt at rest + RLS-isolate.

**Sandbox steps (dev + CI):**
1. Dashboard signup → `client_id` + Sandbox secret (`dashboard.plaid.com/developers/keys`), base URL `https://sandbox.plaid.com`.
2. `/sandbox/public_token/create` to **skip the Link UI** (pass `institution_id` e.g. `ins_109508`, `initial_products:['transactions']`) → mint `public_token` in code → exchange.
3. Inject deterministic AI/cloud-bill-shaped transactions via the `user_custom` username + JSON config (merchant_name `OpenAI`/`Vercel`/`Anthropic`, dated rows; limits ~250 txns / ~55kb / max 10 accounts). Sandbox txns move pending→posted at their date.
4. `/sandbox/item/fire_webhook` to drive `SYNC_UPDATES_AVAILABLE` and test the full ingestion + MCP-tagging path end-to-end with no real bank and no clicks (fits the repo's lab-fixtures + visual-verification workflow).

⚠️ **OAuth banks (Chase, etc.)** require a registered HTTPS `redirect_uri` + app registration in the Plaid dashboard before Production — a launch-blocking dashboard step. Confirm target banks are OAuth-supported.

### 5.3 AI/cloud invoice & usage parsers (the moat)

**Two ingestion tiers per provider:** (1) **high-fidelity API pull** — returns native project/workspace IDs, reconciles to invoice; (2) **emailed-receipt fallback** — no project dimension, needs MCP/manual tag. Default to API where project granularity exists.

| Provider | API path | Native project axis? | Granularity / notes | Auth gate |
|---|---|---|---|---|
| **OpenAI** | `GET /v1/organization/costs` (`group_by project_id\|api_key_id\|line_item`); Usage at `/v1/organization/usage/completions` | ✅ **`project_id`** ~1:1 with foundr project | Daily buckets; `amount.value` float USD. **Use Costs (not Usage) as financial source of truth** (Usage/Costs may diverge). No auto-emailed PDF (portal download only). | **Org admin key** (not inference key) |
| **Anthropic** | `GET /v1/organizations/cost_report` (`group_by workspace_id\|description`) | ✅ **`workspace_id`** (`wrkspc_…`) | Daily only; `amount` = cents as decimal string; ⚠️ **Priority Tier costs absent from cost_report** (derive from usage endpoint). | **Admin key `sk-ant-admin…`; UNAVAILABLE to individual (non-org) accounts** |
| **Vercel** | `GET /v1/billing/charges` (FOCUS v1.3 JSONL) | ✅ **`Tags.ProjectId` + `ProjectName`** on every row | Zero-transform FOCUS drop-in; `BilledCost`/`EffectiveCost` dollar decimals; 1-day granularity, ≤1yr range. | Owner/Member/Developer/Billing role token |
| **Cursor** | `POST /teams/spend`, `/teams/filtered-usage-events` | ❌ **per-user, Enterprise-only** | `chargedCents`/`totalCents`; 90-day (Admin) / 30-day (Analytics) caps; Basic auth (key as username). Solo founder on Pro ⇒ **email receipt only**. | Enterprise team key |
| **Supabase** | Management API (Bearer PAT) | ❌ **per-organization invoice** | Usage summed across all projects into one org invoice; no per-project breakdown. Whole charge → the project owning the org. | Personal access token |
| **AWS** (wave 2) | Cost Explorer `GetCostAndUsage` (`group_by TAG`/`LINKED_ACCOUNT`) | ❌ requires user-defined cost-allocation tags | No native "project"; `LINKED_ACCOUNT` is closest. Second-wave, not launch moat. | Admin-scoped |
| **Stripe** (receipts) | Invoice object `lines[]` | n/a | `lines[].amount` smallest-unit integer + description + period; merchant from receipt header/descriptor. | per-account restricted key |

### 5.4 Ship ONE Stripe-receipt parser first

OpenAI, Anthropic, **and** Cursor all bill through Stripe and email a Stripe-shaped receipt → **one robust Stripe-receipt parser + a per-provider line-item dictionary covers most of the email surface.** Parse `lines[]` (description + smallest-unit amount + period), map merchant→provider from the receipt header/descriptor, then map description→project via the MCP loop. (OpenAI doesn't auto-email the PDF — for OpenAI line-item detail prefer the Costs API.)

**Onboarding the admin-key friction head-on:** OpenAI Costs / Anthropic cost_report / Cursor spend all need **org-admin/admin-scoped credentials**, NOT the inference key the founder already has — and Anthropic's is **unavailable to non-org accounts**, blocking the cleanest path for exactly the solo ICP unless they create an org. Onboarding copy must explain this; for solo users with only a personal Anthropic account, **fall back to the emailed Stripe receipt path.** These admin keys are high-privilege secrets (a leaked `sk-ant-admin` is far worse than an inference key) — encrypt + rotate + read-only scope; some ToS may restrict third-party admin-key use.

### 5.5 Amount-unit normalization + reconciliation (two silent-bug surfaces)

Persist amounts **exactly as the provider reports**, normalize to integer cents on ingest:
- Anthropic: cents as **decimal string** · Cursor: **cents** · OpenAI: **dollars as float** · Stripe: **smallest-unit integer** · Vercel: **dollar decimals**.
- **Never do float math on mixed-unit inputs** — a single mis-scaled parser silently corrupts per-project P&L.

**Reconcile provider invoice ⇄ card charge** (same amount + merchant + date window) or per-project burn for AI/cloud line items **inflates ~2×** (counted once as the parsed OpenAI invoice and once as the Amex charge that paid it). Checksum each provider's per-period total against the emailed invoice total to catch reconciliation drift (OpenAI warns Usage/Costs may diverge; Anthropic excludes Priority Tier from cost_report). Backfill needs **paginated, throttled jobs** (Cursor 90/30-day, Anthropic ~1/min, Vercel ≤1yr range).

### 5.6 Multi-Stripe-account MRR (the "no idea what my total MRR is" pain)

These are **separate accounts, not Connect.** Store **one restricted key per account** (`rak_`, read-only, encrypted secret store), query each separately, sum. Per account = one `financial_accounts` row (`provider='stripe'`). Normalize each **active** subscription to monthly: annual/12, quarterly/3, monthly as-is, weekly×52/12; subtract monthly-normalized discounts (fixed discounts apply per billing period — normalize before subtracting); **exclude one-time/setup/usage** charges. `amount_paid` is the cash-basis figure; use `period_start/period_end` (not `created`) for revenue-period allocation. Sum per project AND founder-wide. Non-USD: convert at finalization-time FX, store the rate.

---

## 6. AI Tagging Design (rules-first → LLM via AI Gateway)

**Architecture: 3-stage cascade, LLM last** (production-proven — ANNA business-banking + the OSS Plaid+pgvector reference):

1. **Deterministic `merchant_rules` table** matched first, **zero LLM cost** (handles 60–80%). Key rules on a **normalized merchant field** (keep raw descriptor as fallback — Plaid enrichment is inconsistent).
2. **(Optional) pgvector similarity** over the user's **confirmed** past transactions (embed `merchant_name + memo`).
3. **LLM fallback** via AI Gateway, only for novel/low-similarity merchants.

**Model:** `model: 'anthropic/claude-haiku-4.5'` (**PERIOD**, verified live). $1/$5 per M in/out, 200K ctx, Anthropic/Bedrock/Vertex failover. **FIX the CLAUDE.md reference that uses `anthropic/claude-haiku-4-5` — that ID 404s.** Resolve the model ID via a single config constant (gateway IDs drift — opus-4.6/4.7/4.8 already listed).

**API choice:** use **`generateObject`** (v5 API, still fully supported in AI SDK 6 — Vercel's docs do NOT confirm third-party "deprecated" claims). It returns a clean `{ object }`. Reserve `generateText({ output: Output.object(...) })` for any future flow where the model also calls a tool (e.g. fetch an invoice line) in the same request. **Pin the AI SDK major version** in `package.json`; write the call so a v5→v6 codemod is trivial.

**Schema (confidence + abstain are first-class):**
```ts
z.object({
  id: z.string(),                                  // echo the input txn id back
  project_id: z.enum([...userProjectIds, '__needs_review__']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe('one-line why'),
  is_new_project_suggested: z.boolean(),
})
```
Route `confidence < ~0.7` OR `__needs_review__` → the in-loop human/MCP tag (this **IS** Angle 03). `.describe()` each field — it materially improves accuracy.

**Prompt caching (highest cost lever):** pass the user's project list (id, name, one-line description) as a **system block** with `providerOptions: { gateway: { caching: 'auto' } }` — it's static across a session/batch (Anthropic +25% write premium, cheap reads). Mirror ANNA caching its static rulebook. Optional `providerOptions.gateway.sort: 'cost'`.

**Batching (avoid the silent mis-attribution bug):** send a **stable `id` per txn** in input AND **require it echoed** in output; **cap batch at ~50–100** (ANNA saw 2–3% id-hallucination >100). Validate every returned id maps to an input id; re-queue mismatches. For monthly/year-end bulk re-categorization, lean on the providers' **50%-off batch APIs** (classification is non-real-time).

**Feedback loop (makes it cheaper AND more accurate per user):** every confirm/override writes `tagging_feedback`. On confirm of a high-confidence merchant with no rule yet → **auto-promote to a deterministic `merchant_rules` row** (never hits the LLM again). On override → store as a **few-shot example** (alternating user/assistant `ModelMessages`) injected on subsequent calls for that user. Recurring subscriptions auto-allocate via `recurring_streams.default_project_id` without re-asking.

**Error handling:** wrap every call in `try/catch` on `NoObjectGeneratedError.isInstance(error)`; log `.text`/`.usage`/`.cause`; on failure mark the txn `__needs_review__` rather than crash the batch. `maxRetries` default 2; consider `experimental_repairText` for malformed JSON.

⚠️ **Confidence is model self-report, NOT a calibrated probability** — do not treat 0.9 as 90%. Calibrate thresholds empirically against real user-override rates; **prefer the abstain-to-review path over a high auto-apply threshold early on.** Flag for eval.

---

## 7. Brand / Design Tokens (look native to foundr.company)

foundr.money already lives on the parent marketing site and uses these exact tokens. **MATCH foundr.company's blue on white — do NOT inherit the host repo's sage `#9bbf83`** (foundr.money is a separate product in the ecosystem). Lift exact hex/classes; do not eyeball.

### 7.1 Tailwind v4 `@theme` custom properties
```css
@theme {
  --color-ink:          #111827;  /* slate-900 — body + headings */
  --color-subtle:       #94a3b8;  /* slate-400 — eyebrows, Soon badge, captions */
  --color-muted:        #475569;  /* slate-600 — "by Perea", secondary links */
  --color-accent:       #3b82f6;  /* blue-500 — buttons, links, wordmark dot, .money TLD, step numbers */
  --color-accent-hover: #2563eb;  /* blue-600 */
  --color-line:         #e2e8f0;  /* slate-200 — hairline borders */
  --color-line-strong:  #111827;  /* ink — hover border */
  --color-surface:      #ffffff;
  --color-bg:           #ffffff;
  --color-bg-alt:       #f8fafc;  /* slate-50 — alternating section bands ⚠️ verify exact hex from computed style before locking */
  --color-success:      #16a34a;  /* green-600 — Live */
  --color-warning:      #d97706;  /* amber-600 — Beta */
}
```

### 7.2 Fonts (self-host via `next/font` — match metrics, avoid FOUT)
- **Poppins** `--font-display` (500/600/700) — headings
- **Roboto** `--font-sans` (300/400/500/700) — body (default)
- **Inconsolata** `--font-mono` (400/500) — eyebrows, badges, numeric/step labels

### 7.3 Component guidance
- **Wordmark:** `inline-flex items-center gap-2 font-display text-base font-semibold text-ink` → a `h-2.5 w-2.5 rounded-full bg-accent` dot + `foundr` + `<span class="text-accent">.money</span>`. **Accent is reserved for the CURRENT product's own TLD**; on cross-links back to parent/other tools the TLD span is `text-subtle`.
- **Status badge** (flat text + dot, NOT a filled chip): `inline-flex gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]` with leading dot; color `text-success`/`text-warning`/`text-subtle`. **Launch as grey "Soon", flip to green "Live" at GA.**
- **Headings:** H1 hero `font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink`; H2 `font-display text-2xl sm:text-3xl font-semibold tracking-tight`; eyebrow `font-mono text-xs uppercase tracking-[0.18em] text-subtle`; card H3 `font-display text-base font-medium`. Body `Roboto text-base text-ink` (~1.55 line-height).
- **Cards:** `rounded-md border border-line bg-surface p-6` — **no resting shadow** — `transition hover:border-line-strong hover:shadow-sm`. Number multi-step cards `font-mono text-xs text-accent` `01`/`02`/`03`.
- **Buttons:** primary `bg-accent text-white rounded-md px-5 py-2.5 font-medium hover:bg-accent-hover`; secondary `bg-surface text-ink border border-line` (same padding). Inline links `text-accent font-medium hover:text-accent-hover` + trailing `→`.
- **Layout:** nav + footer `mx-auto max-w-6xl px-6`, `h-16` nav; hero copy `mx-auto max-w-2xl text-center`; closing/CTA `max-w-3xl text-center`; `py-20` section rhythm; alternate white / `#f8fafc` bands.
- **Voice:** lowercase `foundr.money` in all UI; direct, confident, founder-insider ("burning", "bleeding", "slices by project", "solo founders don't have CFOs"); short declarative sentences; numbered steps ("3 steps, in order."). Footer: `Foundr — tools for the AI-native solo founder · © 2026 Perea`. `<title>`: `foundr.money — Agent-first budgeting that tracks every project's burn.`
- **Product-page IA** (mirror for marketing + in-app empty states): eyebrow+badge → wordmark H1 → one-line headline → subhead → primary+secondary CTA → "What it is" → numbered "How it works" → "What makes it different" (the 5 angles, 3-col expand to 5-card) → "Why it exists" closing band (the 5 pains) → footer.
- **Restraint:** single accent (blue), hairlines not heavy shadows, mono only for labels/numbers/badges. No gradients/glows.

---

## 8. v1 "Curated Product" Scope — what MUST ship, build vs mock, demo narrative

**Principle:** v1 must be *impressive and coherent* end-to-end, with the **moat (project-first P&L + AI/cloud ingestion + MCP tagging) fully real**, and the *commodity/credential-gated edges* (live bank OAuth, multi-provider admin-key pulls) **mocked with realistic seed**. Demo on the lab environment with deterministic fixtures.

### 8.1 MUST ship (real)
1. **Project-first data model** (§3) with the mandatory allocations/splits table, sum-to-total invariant, system "Personal/Unallocated" project, Clerk-native RLS. This is the spine — it must be real.
2. **Per-project P&L view** — the primary screen. Cross-project portfolio rollup ("5 projects on one card") + per-project burn for a period. `'use cache'` loader, brand-native charts.
3. **The MCP `/api/mcp/money` server** (§4) with **all five tools** + **static-key free tier** auth (OAuth Pro flow can be stubbed/feature-flagged for v1 but the static path must work). This is the distribution moat — demoable live from Claude Code/Cursor.
4. **The rules-first → Haiku-4.5 classifier** (§6) with confidence + `__needs_review__` + the confirm→promote-to-rule feedback loop. Real LLM calls via AI Gateway.
5. **One real provider parser end-to-end: the Stripe-receipt parser** (§5.4) — covers OpenAI + Anthropic + Cursor emailed receipts in one stroke, no admin-key gate. **Plus the Vercel FOCUS API pull** (zero-transform, native ProjectId, only needs a team token) as the showcase of "native project granularity."
6. **Tax-aware export** (Schedule C lines + 1099-NEC candidate list ≥ $600 on L11/L17) gated behind Pro — the graduation hook. CSV is enough for v1.

### 8.2 Mock vs build-real (be explicit)
| Surface | v1 decision | Why |
|---|---|---|
| **Plaid bank sync** | **Plaid Sandbox, REAL, with deterministic seed** via `/sandbox/public_token/create` + `user_custom` JSON injecting AI/cloud-bill-shaped txns (OpenAI/Vercel/Anthropic/Amex), driven by `/sandbox/item/fire_webhook`. | Sandbox is free, no approval, exercises the *real* ingestion + webhook-verification + cursor-sync code path. Production OAuth bank registration is a launch-blocking dashboard step — defer to GA. **Do NOT mock the adapter; mock the bank.** |
| **OpenAI/Anthropic Costs API (admin-key)** | **Mock with realistic seed** (canned `costs`/`cost_report` JSON with real `project_id`/`workspace_id` shapes) + show the real `external_project_map` crosswalk UX. | Admin-key/non-org gate is the biggest onboarding-friction; not solvable in a demo. The **Stripe-receipt path is the real fallback** that actually works for the solo ICP. |
| **Vercel FOCUS pull** | **REAL** (only needs a team token, native ProjectId). | Best showcase of the moat with the lowest credential friction. |
| **Cursor/Supabase per-project** | **Single-line-item via Stripe receipt / manual tag**, documented as "no native project axis." | Honest; their APIs lack the dimension. |
| **Multi-Stripe MRR** | **REAL with 2 seeded test-mode Stripe accounts** (restricted keys). | Directly demos "I have multiple Stripe accounts and no idea what my total MRR is." |
| **OAuth Pro MCP flow** | **Stub/feature-flag**; ship static-key free tier real. | Static key is the CAC≈0 viral path; OAuth is polish for GA. |
| **pgvector similarity stage** | **Defer** (cascade goes rules → LLM in v1). | Rules + LLM already hit the production-proven cost target; vector is wave 2. |

### 8.3 Demo narrative (the through-line)
> *"I run five side projects off one personal Amex. No LLC. Brex and Ramp both rejected me — here's their own support page saying they don't accept individuals."*

1. **Connect** (lab): paste the static MCP key into Claude Code — `claude mcp add --transport http foundr-money …`. Connect the Plaid Sandbox "bank" (seeded with a month of real-looking OpenAI/Anthropic/Vercel/Cursor + Amex charges) and a Vercel team token.
2. **Auto-tag**: the rules-first classifier instantly buckets the recurring OpenAI/Vercel charges to the right project (zero LLM cost); a novel merchant gets a Haiku-4.5 suggestion with a confidence score; a low-confidence one lands in `list_untagged`.
3. **Tag in the loop**: in Claude Code, the agent calls `list_untagged`, asks "which project is this $43 surprise bill?", and `tag_transaction` resolves it — **without leaving the terminal where the founder already lives.** This is "tag in the loop you make decisions."
4. **The answer**: `project_pnl` answers "which project caused that surprise bill?" and the portfolio view shows per-project burn across all five — *the thing no QBO configuration can produce at any price without five incorporations and ~$575/mo.*
5. **Multi-Stripe**: two seeded Stripe accounts roll up to one founder-wide MRR number.
6. **Year-end**: the Pro tax-aware export emits Schedule C-lined spend + a 1099-NEC candidate list — the bridge for when a winning project finally incorporates.

**Verify before "done"** (per CLAUDE.md): screenshot the P&L view and the marketing page with `scripts/snap.mjs`; run `pnpm build` before merging any client-side change importing from shared modules (watch the `postgres`-in-bundle leak — use client-safe re-exports). Lab migration applies via Supabase MCP (`apply_migration`) before merge.

---

### Open items to resolve in spec (carried risks)
- **Plaid per-Item $ cost** is undisclosed — get a real dashboard quote before locking $19/$49 unit economics; bound connectable Items per tier.
- **Drop the "$200K Solopreneur ceiling"** everywhere; use the Schedule-C-only capability boundary.
- **Fix `anthropic/claude-haiku-4-5` → `anthropic/claude-haiku-4.5`** in CLAUDE.md and the classifier config.
- **Admin-key / non-org Anthropic gate** is the biggest ICP friction — design the Stripe-receipt fallback as the default, not the exception.
- **Reconciliation/de-dup** (provider invoice ⇄ paying card charge) must ship with the parsers or per-project AI/cloud burn doubles.
- **Multi-bank-per-founder** would trip Plaid's `/user/create` (Multi-Item Link) — verify before architecting it.
- **Tax export is "accountant-ready data prep," NOT tax advice** — scope the copy accordingly (commingling personal/business spend carries liability exposure).
- **Verify the `#f8fafc` band hex** from computed style before locking the brand token.