-- Per-user onboarding state. Drives the first-run wizard: a user with no
-- onboarding row is sent to /onboarding instead of getting auto-seeded demo data.
create table if not exists onboarding (
  owner_id         text primary key,
  completed_at     timestamptz,
  used_sample_data boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table onboarding enable row level security;
