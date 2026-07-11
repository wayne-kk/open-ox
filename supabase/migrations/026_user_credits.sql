-- User credit accounts + ledger (AI build credits v0.1)
-- Balance is per auth user (Workspace = owner surface until multi-member workspaces exist).

create table if not exists public.user_credit_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  plan text not null default 'free',
  last_daily_grant_date date,
  free_month_key text,
  free_month_granted numeric(12, 2) not null default 0 check (free_month_granted >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  reason text,
  project_id text references public.projects (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

create index if not exists credit_ledger_project_id_created_at_idx
  on public.credit_ledger (project_id, created_at desc)
  where project_id is not null;

alter table public.user_credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;

-- Owners can read their own balance and ledger; writes via service role only.
create policy user_credit_accounts_select_own
  on public.user_credit_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy credit_ledger_select_own
  on public.credit_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);
