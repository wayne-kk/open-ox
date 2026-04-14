-- SciCode single-turn data pipeline tables
-- Phase C: problem ingestion + sub-step structure + validation run records

create table if not exists scicode_problems (
  problem_id                 text primary key,
  problem_name               text not null,
  problem_description_main   text not null,
  problem_io                 text not null,
  required_dependencies      jsonb not null default '[]'::jsonb,
  general_tests              jsonb not null default '[]'::jsonb,
  domain                     text,
  difficulty                 text,
  tags                       jsonb not null default '[]'::jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists scicode_problems_domain_difficulty_idx
  on scicode_problems (domain, difficulty, created_at desc);

create table if not exists scicode_sub_steps (
  id                        uuid primary key default gen_random_uuid(),
  problem_id                text not null references scicode_problems(problem_id) on delete cascade,
  step_number               integer not null check (step_number > 0),
  step_description_prompt   text not null,
  function_header           text not null,
  test_cases                jsonb not null default '[]'::jsonb,
  return_line               text not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (problem_id, step_number)
);

create index if not exists scicode_sub_steps_problem_step_idx
  on scicode_sub_steps (problem_id, step_number asc);

create table if not exists scicode_validation_runs (
  id               uuid primary key default gen_random_uuid(),
  problem_id       text not null references scicode_problems(problem_id) on delete cascade,
  status           text not null check (status in ('running', 'passed', 'failed', 'partial')),
  result           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists scicode_validation_runs_problem_created_idx
  on scicode_validation_runs (problem_id, created_at desc);

create index if not exists scicode_validation_runs_status_created_idx
  on scicode_validation_runs (status, created_at desc);

