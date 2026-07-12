-- BYO Vercel OAuth connections + per-project deploy binding (ADR-0003)

create table if not exists public.user_vercel_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vercel_user_id text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  default_team_id text,
  default_team_name text,
  configuration_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_vercel_connections enable row level security;
-- Service role only (tokens never exposed via anon/authenticated RLS)

create table if not exists public.project_vercel_deployments (
  project_id text primary key references public.projects (id) on delete cascade,
  vercel_project_id text,
  vercel_project_name text,
  production_url text,
  last_deploy_id text,
  last_status text not null default 'queued'
    check (last_status in ('queued', 'building', 'uploading', 'ready', 'error')),
  last_error text,
  last_deployed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists project_vercel_deployments_status_idx
  on public.project_vercel_deployments (last_status);

alter table public.project_vercel_deployments enable row level security;

create policy "project_vercel_deployments_select_own"
  on public.project_vercel_deployments for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- Mutations go through service role from API routes
