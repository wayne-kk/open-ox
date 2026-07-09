-- Publish Preview / Allow Remix / lineage (ADR-0002).
-- Defaults: all private (publish_preview off, allow_remix off).

alter table projects
  add column if not exists publish_preview boolean not null default false;

alter table projects
  add column if not exists allow_remix boolean not null default false;

-- Reserved for unlisted preview links (UI not in v0.1).
alter table projects
  add column if not exists listing text not null default 'listed'
    check (listing in ('listed', 'unlisted'));

alter table projects
  add column if not exists remixed_from_project_id text
    references projects (id) on delete set null;

alter table projects
  add column if not exists remixed_from_title text;

alter table projects
  add column if not exists remixed_from_owner_username text;

create index if not exists projects_publish_preview_listed_created_at_idx
  on projects (created_at desc)
  where publish_preview = true and listing = 'listed';

create index if not exists projects_remixed_from_project_id_idx
  on projects (remixed_from_project_id)
  where remixed_from_project_id is not null;

-- Community / public static preview reads (owner-only SELECT remains from 024).
create policy "projects_select_community_listed"
  on projects for select
  using (
    publish_preview = true
    and listing = 'listed'
  );

-- Keep allow_remix consistent with publish_preview at the DB layer.
create or replace function public.projects_clear_remix_when_unlist()
returns trigger
language plpgsql
as $$
begin
  if new.publish_preview is distinct from true then
    new.allow_remix := false;
  end if;
  if new.allow_remix is true and new.publish_preview is distinct from true then
    new.allow_remix := false;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_clear_remix_when_unlist on projects;
create trigger projects_clear_remix_when_unlist
  before insert or update of publish_preview, allow_remix
  on projects
  for each row
  execute function public.projects_clear_remix_when_unlist();
