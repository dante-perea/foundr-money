-- Make sample/demo data honestly removable.
--
-- Onboarding's StepWelcome promises the demo is "clearly labeled, and removable",
-- but nothing distinguished a seeded row from a real one. Add an is_demo flag to
-- every table ensureSeeded() writes so the demo can be (a) labeled in the UI and
-- (b) deleted cleanly without touching the founder's real data.
--
-- transaction_allocations is intentionally NOT flagged: its rows are owned by
-- their parent transaction and cascade-delete (transactions.id ON DELETE CASCADE),
-- so clearing demo transactions removes their allocations for free.

alter table projects             add column if not exists is_demo boolean not null default false;
alter table financial_accounts   add column if not exists is_demo boolean not null default false;
alter table transactions         add column if not exists is_demo boolean not null default false;
alter table recurring_streams    add column if not exists is_demo boolean not null default false;
alter table provider_invoices    add column if not exists is_demo boolean not null default false;
alter table stripe_subscriptions add column if not exists is_demo boolean not null default false;
alter table external_project_map add column if not exists is_demo boolean not null default false;
alter table merchant_rules       add column if not exists is_demo boolean not null default false;

-- Partial indexes on the demo rows only — keeps "does this owner have demo data?"
-- and the clear-sweep cheap without bloating the common is_demo=false path.
create index if not exists idx_projects_demo
  on projects (owner_id) where is_demo;
create index if not exists idx_accounts_demo
  on financial_accounts (owner_id) where is_demo;
create index if not exists idx_txn_demo
  on transactions (owner_id) where is_demo;
create index if not exists idx_recurring_demo
  on recurring_streams (owner_id) where is_demo;
create index if not exists idx_invoices_demo
  on provider_invoices (owner_id) where is_demo;
create index if not exists idx_stripe_subs_demo
  on stripe_subscriptions (owner_id) where is_demo;
create index if not exists idx_external_map_demo
  on external_project_map (owner_id) where is_demo;
create index if not exists idx_rules_demo
  on merchant_rules (owner_id) where is_demo;
