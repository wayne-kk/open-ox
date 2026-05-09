-- Intent agent sets status to awaiting_input between turns (see /api/ai/intent-agent).
-- Original check in 001_create_projects.sql only allowed generating | ready | failed.

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('awaiting_input', 'generating', 'ready', 'failed'));
