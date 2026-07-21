-- BYO Supabase OAuth connections + per-project backend binding (product plan)
-- Tokens / keys encrypted at rest; service-role writes only for secrets.

create table if not exists public.user_supabase_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  supabase_org_slug text not null,
  supabase_org_name text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_supabase_connections enable row level security;
-- No policies: tokens never exposed via anon/authenticated RLS

create table if not exists public.project_backends (
  project_id text primary key references public.projects (id) on delete cascade,
  mode text not null default 'byo'
    check (mode in ('byo', 'sandbox')),
  supabase_project_ref text not null,
  supabase_project_name text,
  supabase_url text not null,
  publishable_key_enc text,
  service_key_enc text,
  db_pass_enc text,
  status text not null default 'linking'
    check (status in ('linking', 'ready', 'error', 'needs_reauth')),
  last_error text,
  last_migration_version text,
  last_seed_at timestamptz,
  advisor_json jsonb,
  preview_backend_override text
    check (preview_backend_override in ('local', 'e2b')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_backends_status_idx
  on public.project_backends (status);

alter table public.project_backends enable row level security;

create policy "project_backends_select_own"
  on public.project_backends for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
-- Mutations go through service role from API routes.
-- API layer must strip *_enc columns from JSON responses.

create table if not exists public.project_schema_plans (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  version int not null,
  domain text,
  plan_json jsonb not null,
  migration_sql text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'applied', 'failed', 'rejected')),
  error text,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists project_schema_plans_project_idx
  on public.project_schema_plans (project_id, version desc);

alter table public.project_schema_plans enable row level security;

create policy "project_schema_plans_select_own"
  on public.project_schema_plans for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create table if not exists public.project_seed_plans (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  version int not null,
  plan_json jsonb not null,
  seed_sql text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'applied', 'failed', 'rejected')),
  error text,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists project_seed_plans_project_idx
  on public.project_seed_plans (project_id, version desc);

alter table public.project_seed_plans enable row level security;

create policy "project_seed_plans_select_own"
  on public.project_seed_plans for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
