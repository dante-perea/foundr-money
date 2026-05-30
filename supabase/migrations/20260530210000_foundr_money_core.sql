-- foundr.money core schema — project-first personal P&L ledger.
-- Money is integer cents (bigint). House sign convention: EXPENSE = POSITIVE,
-- income = negative. owner_id is the Clerk user id; access is server-side via
-- the service role, every query scoped by owner_id. RLS is enabled
-- deny-by-default (no anon/authenticated policies) as defense-in-depth — only
-- the service role (which bypasses RLS) touches these tables in v1.

create extension if not exists "pgcrypto";

-- ── enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type project_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_provider as enum
    ('plaid', 'stripe', 'manual', 'openai', 'anthropic', 'vercel', 'supabase', 'cursor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_kind as enum ('card', 'bank', 'stripe_account', 'provider_invoice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_direction as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

-- ── projects (the primary axis) ────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  name        text not null,
  slug        text not null,
  status      project_status not null default 'active',
  is_personal boolean not null default false,  -- the system "Personal/Unallocated" project
  color       text not null default '#3b82f6',
  description text,
  created_at  timestamptz not null default now(),
  unique (owner_id, slug)
);
create index if not exists idx_projects_owner on projects (owner_id);

-- ── categories (secondary axis; seeded from Schedule C) ─────────────────────
create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text,                 -- null = system default
  label           text not null,
  schedule_c_line text,                 -- e.g. 'L18', 'L22'
  is_income       boolean not null default false,
  sort            int not null default 0
);
create index if not exists idx_categories_owner on categories (owner_id);

-- ── financial accounts (abstracts every money source) ──────────────────────
create table if not exists financial_accounts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          text not null,
  provider          account_provider not null,
  kind              account_kind not null,
  display_name      text not null,
  last4             text,
  currency          text not null default 'usd',
  plaid_item_id     text,
  plaid_account_id  text,
  stripe_account_id text,
  credential_ref    text,               -- pointer to encrypted secret, never raw
  sync_cursor       text,
  status            text not null default 'active',
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_accounts_owner on financial_accounts (owner_id);

-- ── transactions (single signed ledger) ────────────────────────────────────
create table if not exists transactions (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             text not null,
  financial_account_id uuid not null references financial_accounts (id) on delete cascade,
  external_id          text not null,
  posted_at            date not null,
  authorized_at        date,
  amount_cents         bigint not null,            -- house: expense = positive
  raw_amount_cents     bigint not null,
  raw_sign_source      text not null default 'manual',
  direction            txn_direction not null,
  currency             text not null default 'usd',
  merchant_name        text,
  description          text,
  pfc_primary          text,                       -- Plaid category hint only
  pfc_detailed         text,
  pfc_confidence       text,
  pending              boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (financial_account_id, external_id)
);
create index if not exists idx_txn_owner on transactions (owner_id);
create index if not exists idx_txn_posted on transactions (owner_id, posted_at desc);

-- ── transaction_allocations (the splits — the project link; mandatory) ──────
create table if not exists transaction_allocations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       text not null,
  transaction_id uuid not null references transactions (id) on delete cascade,
  project_id     uuid not null references projects (id) on delete restrict,
  category_id    uuid references categories (id) on delete set null,
  amount_cents   bigint not null,
  pct            numeric(7,4),
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_alloc_txn on transaction_allocations (transaction_id);
create index if not exists idx_alloc_project on transaction_allocations (project_id);
create index if not exists idx_alloc_owner on transaction_allocations (owner_id);

-- ── sum-to-total invariant (deferrable; checked at commit) ──────────────────
create or replace function fm_check_alloc_sum() returns trigger
language plpgsql as $$
declare v_txn uuid; v_total bigint; v_alloc bigint;
begin
  v_txn := coalesce(NEW.transaction_id, OLD.transaction_id);
  select amount_cents into v_total from transactions where id = v_txn;
  if v_total is null then return null; end if;  -- parent txn gone
  select coalesce(sum(amount_cents), 0) into v_alloc
    from transaction_allocations where transaction_id = v_txn;
  if v_alloc <> v_total then
    raise exception 'foundr.money: allocations (%) must sum to txn total (%) for txn %',
      v_alloc, v_total, v_txn;
  end if;
  return null;
end $$;

create or replace function fm_check_txn_allocated() returns trigger
language plpgsql as $$
declare v_alloc bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_alloc
    from transaction_allocations where transaction_id = NEW.id;
  if v_alloc <> NEW.amount_cents then
    raise exception 'foundr.money: txn % must be fully allocated (% != %)',
      NEW.id, v_alloc, NEW.amount_cents;
  end if;
  return null;
end $$;

drop trigger if exists trg_alloc_sum on transaction_allocations;
create constraint trigger trg_alloc_sum
  after insert or update or delete on transaction_allocations
  deferrable initially deferred for each row execute function fm_check_alloc_sum();

drop trigger if exists trg_txn_allocated on transactions;
create constraint trigger trg_txn_allocated
  after insert or update of amount_cents on transactions
  deferrable initially deferred for each row execute function fm_check_txn_allocated();

-- ── plaid items (access-token lifecycle) ────────────────────────────────────
create table if not exists plaid_items (
  item_id          text primary key,
  owner_id         text not null,
  access_token     text not null,       -- encrypt at rest in prod
  cursor           text,
  institution_name text,
  status           text not null default 'active',
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_plaid_owner on plaid_items (owner_id);

-- ── recurring streams (subscription detection) ──────────────────────────────
create table if not exists recurring_streams (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             text not null,
  financial_account_id uuid references financial_accounts (id) on delete cascade,
  plaid_stream_id      text,
  merchant_name        text not null,
  average_amount_cents bigint not null default 0,
  frequency            text,
  last_amount_cents    bigint,
  last_date            date,
  is_active            boolean not null default true,
  default_project_id   uuid references projects (id) on delete set null,
  default_category_id  uuid references categories (id) on delete set null
);
create index if not exists idx_recurring_owner on recurring_streams (owner_id);

-- ── provider invoices (the moat) ────────────────────────────────────────────
create table if not exists provider_invoices (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             text not null,
  financial_account_id uuid references financial_accounts (id) on delete set null,
  provider             account_provider not null,
  external_invoice_id  text,
  period_start         date,
  period_end           date,
  total_cents          bigint not null default 0,
  currency             text not null default 'usd',
  line_items           jsonb not null default '[]'::jsonb,
  source_blob_url      text,
  external_project_ref text,
  reconciled_txn_id    uuid references transactions (id) on delete set null,
  parsed_at            timestamptz not null default now()
);
create index if not exists idx_invoices_owner on provider_invoices (owner_id);

-- ── stripe subscriptions (multi-account MRR) ────────────────────────────────
create table if not exists stripe_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               text not null,
  financial_account_id   uuid references financial_accounts (id) on delete cascade,
  stripe_subscription_id text,
  status                 text not null default 'active',
  interval               text not null default 'month',
  interval_count         int not null default 1,
  amount_cents           bigint not null default 0,
  discount_monthly_cents bigint not null default 0,
  currency               text not null default 'usd',
  project_id             uuid references projects (id) on delete set null
);
create index if not exists idx_stripe_subs_owner on stripe_subscriptions (owner_id);

-- ── external project crosswalk (provider-native project ⇄ foundr project) ───
create table if not exists external_project_map (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  provider    account_provider not null,
  external_id text not null,
  project_id  uuid not null references projects (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (owner_id, provider, external_id)
);

-- ── merchant rules (deterministic tagging — rules-first classifier) ─────────
create table if not exists merchant_rules (
  id               uuid primary key default gen_random_uuid(),
  owner_id         text not null,
  merchant_pattern text not null,       -- normalized merchant token
  project_id       uuid not null references projects (id) on delete cascade,
  category_id      uuid references categories (id) on delete set null,
  source           text not null default 'manual',  -- manual | promoted
  created_at       timestamptz not null default now(),
  unique (owner_id, merchant_pattern)
);
create index if not exists idx_rules_owner on merchant_rules (owner_id);

-- ── tagging feedback (the MCP learning loop) ────────────────────────────────
create table if not exists tagging_feedback (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             text not null,
  transaction_id       uuid references transactions (id) on delete cascade,
  suggested_project_id uuid references projects (id) on delete set null,
  confirmed_project_id uuid references projects (id) on delete set null,
  was_override         boolean not null default false,
  confidence           numeric,
  created_at           timestamptz not null default now()
);

-- ── MCP static agent keys (free-tier bearer) ────────────────────────────────
create table if not exists money_agent_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null,
  key_hash     text not null unique,    -- sha256 of the fm_ token
  label        text not null default 'default',
  scopes       text[] not null default array['mcp:money:read','mcp:money:write'],
  status       text not null default 'active',
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_keys_owner on money_agent_keys (owner_id);

-- ── MCP call audit log (act-chain provenance is a product feature) ──────────
create table if not exists mcp_call_log (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text not null,
  agent_key_id    uuid references money_agent_keys (id) on delete set null,
  tool_name       text not null,
  request_payload jsonb,
  act_chain       jsonb,
  status          text not null default 'ok',
  latency_ms      int,
  created_at      timestamptz not null default now()
);
create index if not exists idx_mcplog_owner on mcp_call_log (owner_id, created_at desc);

-- ── enable RLS deny-by-default on every table (service role bypasses) ───────
do $$
declare t text;
begin
  foreach t in array array[
    'projects','categories','financial_accounts','transactions','transaction_allocations',
    'plaid_items','recurring_streams','provider_invoices','stripe_subscriptions',
    'external_project_map','merchant_rules','tagging_feedback','money_agent_keys','mcp_call_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ── seed system categories (Schedule C Part II + income) ────────────────────
insert into categories (owner_id, label, schedule_c_line, is_income, sort) values
  (null, 'Advertising',            'L8',   false, 8),
  (null, 'Contract labor',         'L11',  false, 11),
  (null, 'Insurance',              'L15',  false, 15),
  (null, 'Legal & professional',   'L17',  false, 17),
  (null, 'Office expense',         'L18',  false, 18),
  (null, 'Rent / lease',           'L20b', false, 20),
  (null, 'Repairs & maintenance',  'L21',  false, 21),
  (null, 'Supplies',               'L22',  false, 22),
  (null, 'Taxes & licenses',       'L23',  false, 23),
  (null, 'Travel',                 'L24a', false, 24),
  (null, 'Meals',                  'L24b', false, 25),
  (null, 'Utilities',              'L25',  false, 26),
  (null, 'Software & SaaS',        'L27a', false, 27),
  (null, 'AI & compute',           'L27a', false, 28),
  (null, 'Other expenses',         'L27a', false, 99),
  (null, 'Sales / revenue',        null,   true,  1),
  (null, 'Consulting income',      null,   true,  2)
on conflict do nothing;
