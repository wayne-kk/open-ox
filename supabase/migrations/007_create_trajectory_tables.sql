-- Agentic trajectory storage
-- Stores run metadata and ordered event stream in Supabase.

create table if not exists trajectory_runs (
  run_id         text primary key,
  task_id        text not null,
  schema_version text not null default 'tbx.0.1',
  status         text not null check (status in ('running', 'finished')),
  last_seq       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists trajectory_events (
  id             bigint generated always as identity primary key,
  run_id         text not null references trajectory_runs(run_id) on delete cascade,
  seq            integer not null,
  event          jsonb not null,
  created_at     timestamptz not null default now(),
  unique (run_id, seq)
);

create index if not exists trajectory_runs_task_id_created_idx
  on trajectory_runs (task_id, created_at desc);

create index if not exists trajectory_events_run_seq_idx
  on trajectory_events (run_id, seq asc);
