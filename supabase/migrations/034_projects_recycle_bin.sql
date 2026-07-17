-- Recycle Bin: soft delete + optional auto-purge schedule.
-- Trashed projects leave Community via publish flags cleared in app code;
-- RLS also excludes deleted_at IS NOT NULL as belt-and-suspenders.

alter table projects
  add column if not exists deleted_at timestamptz null;

alter table projects
  add column if not exists purge_after timestamptz null;

create index if not exists projects_owner_deleted_at_idx
  on projects (user_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists projects_purge_after_due_idx
  on projects (purge_after)
  where deleted_at is not null and purge_after is not null;

-- Community SELECT: never surface soft-deleted rows.
drop policy if exists "projects_select_community_listed" on projects;
create policy "projects_select_community_listed"
  on projects for select
  using (
    publish_preview = true
    and listing = 'listed'
    and deleted_at is null
  );
