-- Recently opened: track when an owner last opened a project in Studio.

alter table projects
  add column if not exists last_opened_at timestamptz null;

create index if not exists projects_user_last_opened_idx
  on projects (user_id, last_opened_at desc nulls last)
  where deleted_at is null and last_opened_at is not null;
