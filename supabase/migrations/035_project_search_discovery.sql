-- Search discovery for Publish Preview projects.

alter table projects
  add column if not exists search_indexing_enabled boolean not null default false,
  add column if not exists seo_slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published_at timestamptz,
  add column if not exists seo_updated_at timestamptz;

update projects
set
  seo_slug = coalesce(
    nullif(seo_slug, ''),
    nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
    'project'
  ),
  published_at = coalesce(published_at, updated_at, created_at),
  seo_updated_at = coalesce(seo_updated_at, updated_at, created_at)
where publish_preview = true;

create index if not exists projects_search_indexable_updated_idx
  on projects (seo_updated_at desc, id)
  where publish_preview = true
    and listing = 'listed'
    and search_indexing_enabled = true
    and deleted_at is null
    and static_preview_synced_at is not null;

create table if not exists search_discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  action text not null check (action in ('publish', 'update', 'remove')),
  seo_slug text not null,
  pending_engines text[] not null default array['indexnow', 'baidu']::text[],
  engine_results jsonb not null default '{}'::jsonb,
  content_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'dead', 'superseded')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (project_id, action, content_version)
);

create index if not exists search_discovery_jobs_due_idx
  on search_discovery_jobs (next_attempt_at, created_at)
  where status = 'pending';

alter table search_discovery_jobs enable row level security;

create table if not exists project_search_tombstones (
  project_id text primary key,
  seo_slug text not null,
  removed_at timestamptz not null default now()
);

alter table project_search_tombstones enable row level security;
drop policy if exists "project_search_tombstones_public_read" on project_search_tombstones;
create policy "project_search_tombstones_public_read"
  on project_search_tombstones for select
  using (true);

create or replace function public.claim_search_discovery_jobs(batch_size integer default 20)
returns setof search_discovery_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update search_discovery_jobs
  set status = 'pending', next_attempt_at = now()
  where status = 'processing' and next_attempt_at < now() - interval '15 minutes';

  return query
  update search_discovery_jobs jobs
  set status = 'processing', attempts = jobs.attempts + 1
  where jobs.id in (
    select due.id
    from search_discovery_jobs due
    where due.status = 'pending' and due.next_attempt_at <= now()
    order by due.created_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  )
  returning jobs.*;
end;
$$;

revoke all on function public.claim_search_discovery_jobs(integer) from public;
revoke all on function public.claim_search_discovery_jobs(integer) from anon;
revoke all on function public.claim_search_discovery_jobs(integer) from authenticated;
grant execute on function public.claim_search_discovery_jobs(integer) to service_role;

create or replace function public.project_is_search_indexable(p projects)
returns boolean
language sql
immutable
as $$
  select p.publish_preview = true
    and p.listing = 'listed'
    and p.search_indexing_enabled = true
    and p.deleted_at is null
    and p.static_preview_synced_at is not null;
$$;

create or replace view public.search_indexable_projects
with (security_invoker = true)
as
select
  id, name, seo_slug, seo_updated_at, updated_at, cover_image_updated_at
from projects
where project_is_search_indexable(projects);

create or replace function public.list_search_sitemap_shards(shard_size integer default 10000)
returns table(page integer, after_id text)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      id,
      row_number() over (order by id) as row_number,
      lag(id) over (order by id) as previous_id
    from search_indexable_projects
  )
  select
    ((row_number - 1) / greatest(1, least(shard_size, 20000)))::integer as page,
    previous_id as after_id
  from ranked
  where mod(row_number - 1, greatest(1, least(shard_size, 20000))) = 0
  order by row_number;
$$;

revoke all on function public.list_search_sitemap_shards(integer) from public;
revoke all on function public.list_search_sitemap_shards(integer) from anon;
revoke all on function public.list_search_sitemap_shards(integer) from authenticated;
grant execute on function public.list_search_sitemap_shards(integer) to service_role;

create or replace function public.projects_enqueue_search_discovery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_indexable boolean := project_is_search_indexable(old);
  is_indexable boolean := project_is_search_indexable(new);
  job_action text;
  version text;
  affected integer;
begin
  if old.publish_preview = true
    and old.listing = 'listed'
    and old.deleted_at is null
    and old.static_preview_synced_at is not null
    and not (
      new.publish_preview = true
      and new.listing = 'listed'
      and new.deleted_at is null
      and new.static_preview_synced_at is not null
    ) then
    insert into project_search_tombstones (project_id, seo_slug, removed_at)
    values (old.id, old.seo_slug, now())
    on conflict (project_id) do update set
      seo_slug = excluded.seo_slug,
      removed_at = excluded.removed_at;
  elsif new.publish_preview = true
    and new.listing = 'listed'
    and new.deleted_at is null
    and new.static_preview_synced_at is not null then
    delete from project_search_tombstones where project_id = new.id;
  end if;

  if not was_indexable and is_indexable then
    job_action := 'publish';
    new.published_at := coalesce(new.published_at, now());
    new.seo_updated_at := now();
  elsif was_indexable and not is_indexable then
    job_action := 'remove';
  elsif is_indexable and (
    new.name is distinct from old.name or
    new.user_prompt is distinct from old.user_prompt or
    new.cover_image_updated_at is distinct from old.cover_image_updated_at or
    new.static_preview_synced_at is distinct from old.static_preview_synced_at or
    new.seo_title is distinct from old.seo_title or
    new.seo_description is distinct from old.seo_description or
    new.seo_slug is distinct from old.seo_slug
  ) then
    job_action := 'update';
    new.seo_updated_at := now();
  else
    return new;
  end if;

  version := extract(epoch from clock_timestamp())::text;

  if job_action = 'update' then
    update search_discovery_jobs
    set
      seo_slug = new.seo_slug,
      content_version = version,
      pending_engines = array['indexnow', 'baidu']::text[],
      attempts = 0,
      next_attempt_at = now() + interval '30 minutes',
      last_error = null
    where id = (
      select id from search_discovery_jobs
      where project_id = new.id
        and action = 'update'
        and status = 'pending'
        and created_at > now() - interval '30 minutes'
      order by created_at desc
      limit 1
    );
    get diagnostics affected = row_count;
    if affected > 0 then return new; end if;
  end if;

  update search_discovery_jobs
  set status = 'superseded', completed_at = now()
  where project_id = new.id
    and status = 'pending'
    and action <> job_action;

  insert into search_discovery_jobs (
    project_id, action, seo_slug, pending_engines, content_version
  )
  values (
    new.id,
    job_action,
    case when job_action = 'remove' then old.seo_slug else new.seo_slug end,
    array['indexnow', 'baidu']::text[],
    version
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists projects_search_discovery on projects;
create trigger projects_search_discovery
  before update of publish_preview, listing, search_indexing_enabled,
    deleted_at, static_preview_synced_at, name, user_prompt, cover_image_updated_at,
    seo_title, seo_description, seo_slug
  on projects
  for each row
  execute function public.projects_enqueue_search_discovery();
