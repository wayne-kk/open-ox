-- Admin audit trail + optional internal account registry for analytics filtering

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  resource text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_admin_user_id_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create table if not exists public.analytics_internal_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.analytics_internal_accounts enable row level security;
