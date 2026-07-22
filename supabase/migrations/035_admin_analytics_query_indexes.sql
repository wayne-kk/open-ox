-- Keep admin analytics range and queue-health queries index-backed as data grows.

create index if not exists generation_runs_created_at_idx
  on public.generation_runs (created_at desc);

create index if not exists generation_runs_status_finished_at_idx
  on public.generation_runs (status, finished_at desc)
  where finished_at is not null;

create index if not exists projects_user_created_at_idx
  on public.projects (user_id, created_at)
  where user_id is not null;

create index if not exists projects_ready_user_completed_at_idx
  on public.projects (user_id, completed_at)
  where status = 'ready' and user_id is not null;
