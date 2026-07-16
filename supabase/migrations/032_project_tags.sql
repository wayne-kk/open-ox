-- User-owned project tags (many-to-many). Workspace organization alongside folders.

create table if not exists project_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists project_tags_user_id_idx on project_tags (user_id);

create table if not exists project_tag_links (
  project_id text not null references projects (id) on delete cascade,
  tag_id     uuid not null references project_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, tag_id)
);

create index if not exists project_tag_links_tag_id_idx on project_tag_links (tag_id);
create index if not exists project_tag_links_project_id_idx on project_tag_links (project_id);

alter table project_tags enable row level security;
alter table project_tag_links enable row level security;

create policy "project_tags_select_own"
  on project_tags for select
  using (user_id = (select auth.uid()));

create policy "project_tags_insert_own"
  on project_tags for insert
  with check (user_id = (select auth.uid()));

create policy "project_tags_update_own"
  on project_tags for update
  using (user_id = (select auth.uid()));

create policy "project_tags_delete_own"
  on project_tags for delete
  using (user_id = (select auth.uid()));

-- Links are owned via the project's owner (and tag must belong to same user).
create policy "project_tag_links_select_own"
  on project_tag_links for select
  using (
    exists (
      select 1 from projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "project_tag_links_insert_own"
  on project_tag_links for insert
  with check (
    exists (
      select 1 from projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from project_tags t
      where t.id = tag_id and t.user_id = (select auth.uid())
    )
  );

create policy "project_tag_links_delete_own"
  on project_tag_links for delete
  using (
    exists (
      select 1 from projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
