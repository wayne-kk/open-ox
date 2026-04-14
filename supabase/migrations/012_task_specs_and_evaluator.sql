-- Terminal-Bench style data platform foundations
-- Phase A/B: task packages + trajectory run governance + evaluator records

-- ── 1) Task specs (standardized task package) ───────────────────────────────
create table if not exists task_specs (
  task_id            text primary key,
  domain             text not null check (
    domain in ('software_engineering', 'sysadmin', 'ml', 'security', 'data_science')
  ),
  goal               text not null,
  setup              jsonb not null default '{}'::jsonb,
  tests              jsonb not null default '[]'::jsonb,
  success_criteria   jsonb not null default '[]'::jsonb,
  constraints        jsonb,
  difficulty         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists task_specs_domain_created_idx
  on task_specs (domain, created_at desc);

-- ── 2) Extend trajectory_runs for reproducibility + governance ──────────────
alter table trajectory_runs
  add column if not exists sandbox_provider text,
  add column if not exists sandbox_id text,
  add column if not exists image_ref text,
  add column if not exists canary_id text,
  add column if not exists pii_redaction boolean not null default false,
  add column if not exists data_source text not null default 'agent' check (
    data_source in ('human', 'agent', 'hybrid')
  ),
  add column if not exists model_id text,
  add column if not exists replayable boolean not null default true,
  add column if not exists ended_at timestamptz;

create index if not exists trajectory_runs_status_started_idx
  on trajectory_runs (status, created_at desc);

create index if not exists trajectory_runs_data_source_idx
  on trajectory_runs (data_source, created_at desc);

create index if not exists trajectory_runs_model_id_idx
  on trajectory_runs (model_id, created_at desc);

-- ── 3) Evaluator runs (run-level scoring / verdict) ─────────────────────────
create table if not exists evaluator_runs (
  id               uuid primary key default gen_random_uuid(),
  run_id           text not null references trajectory_runs(run_id) on delete cascade,
  verdict          text not null check (verdict in ('passed', 'failed', 'partial')),
  score            jsonb not null default '{}'::jsonb,
  failure_type     text,
  summary          text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists evaluator_runs_run_id_created_idx
  on evaluator_runs (run_id, created_at desc);

create index if not exists evaluator_runs_verdict_created_idx
  on evaluator_runs (verdict, created_at desc);

