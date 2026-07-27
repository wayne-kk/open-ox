-- Immutable project source versions and the version used by the latest Vercel deploy.

create table if not exists public.project_versions (
  id uuid primary key,
  project_id text not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source_fingerprint text not null,
  snapshot_storage_path text not null,
  source_kind text not null
    check (source_kind in ('generate', 'modify', 'design_mode', 'manual', 'deploy')),
  summary text,
  verification_status text
    check (verification_status in ('passed', 'failed', 'unknown')),
  created_at timestamptz not null default now(),
  unique (project_id, version_number),
  unique (project_id, source_fingerprint)
);

alter table public.projects
  add column if not exists version_capture_pending boolean not null default false;

create index if not exists project_versions_project_created_idx
  on public.project_versions (project_id, version_number desc);

alter table public.project_versions enable row level security;

create policy "project_versions_select_own"
  on public.project_versions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

alter table public.project_vercel_deployments
  add column if not exists deployed_version_id uuid
    references public.project_versions(id) on delete set null,
  add column if not exists deployed_source_fingerprint text,
  add column if not exists pending_version_id uuid
    references public.project_versions(id) on delete set null;

create or replace function public.register_project_version(
  p_id uuid,
  p_project_id text,
  p_source_fingerprint text,
  p_snapshot_storage_path text,
  p_source_kind text,
  p_summary text default null,
  p_verification_status text default 'unknown'
)
returns public.project_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.project_versions;
  created public.project_versions;
  next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_project_id));

  select * into existing
  from public.project_versions
  where project_id = p_project_id
    and source_fingerprint = p_source_fingerprint;

  if found then
    update public.projects
    set version_capture_pending = false
    where id = p_project_id
      and split_part(coalesce(files_hash, ''), ':', 1) = p_source_fingerprint;
    return existing;
  end if;

  select coalesce(max(version_number), 0) + 1 into next_number
  from public.project_versions
  where project_id = p_project_id;

  insert into public.project_versions (
    id, project_id, version_number, source_fingerprint,
    snapshot_storage_path, source_kind, summary, verification_status
  ) values (
    p_id, p_project_id, next_number, p_source_fingerprint,
    p_snapshot_storage_path, p_source_kind, p_summary, p_verification_status
  ) returning * into created;

  update public.projects
  set version_capture_pending = false
  where id = p_project_id
    and split_part(coalesce(files_hash, ''), ':', 1) = p_source_fingerprint;

  return created;
end;
$$;

revoke all on function public.register_project_version(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_project_version(uuid, text, text, text, text, text, text)
  to service_role;
