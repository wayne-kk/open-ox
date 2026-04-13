-- Account ownership + single-level folders for projects
-- After deploy: backfill legacy rows with your admin user's UUID from Supabase Auth:
--   UPDATE projects SET user_id = '<admin-auth-uuid>'::uuid WHERE user_id IS NULL;

-- ── Folders (one level per user) ───────────────────────────────────────────
create table if not exists project_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists project_folders_user_id_idx on project_folders (user_id);

-- ── Projects: owner + optional folder ───────────────────────────────────────
alter table projects
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table projects
  add column if not exists folder_id uuid references project_folders (id) on delete cascade;

create index if not exists projects_user_id_created_at_idx on projects (user_id, created_at desc);
create index if not exists projects_folder_id_idx on projects (folder_id);

-- ── Row level security ───────────────────────────────────────────────────────
alter table project_folders enable row level security;
alter table projects enable row level security;

create policy "project_folders_select_own"
  on project_folders for select
  using (user_id = (select auth.uid()));

create policy "project_folders_insert_own"
  on project_folders for insert
  with check (user_id = (select auth.uid()));

create policy "project_folders_update_own"
  on project_folders for update
  using (user_id = (select auth.uid()));

create policy "project_folders_delete_own"
  on project_folders for delete
  using (user_id = (select auth.uid()));

create policy "projects_select_own"
  on projects for select
  using (user_id = (select auth.uid()));

create policy "projects_insert_own"
  on projects for insert
  with check (
    user_id = (select auth.uid())
    and (
      folder_id is null
      or exists (
        select 1 from project_folders f
        where f.id = folder_id and f.user_id = (select auth.uid())
      )
    )
  );

create policy "projects_update_own"
  on projects for update
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      folder_id is null
      or exists (
        select 1 from project_folders f
        where f.id = folder_id and f.user_id = (select auth.uid())
      )
    )
  );

create policy "projects_delete_own"
  on projects for delete
  using (user_id = (select auth.uid()));
