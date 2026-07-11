-- Drop unused trajectory / evaluator / scicode / task-spec / style-eval tables and
-- the unimplemented analytics_daily_rollups aggregate table.
-- Code audit 2026-07-11: zero product callers (orphan APIs / pages removed with this change).

-- FK dependents first
drop table if exists public.evaluator_runs;
drop table if exists public.trajectory_events;
drop table if exists public.trajectory_export_audits;
drop table if exists public.trajectory_runs;

drop table if exists public.scicode_validation_runs;
drop table if exists public.scicode_sub_steps;
drop table if exists public.scicode_problems;

drop table if exists public.task_specs;

drop table if exists public.analytics_daily_rollups;

-- Manual table (never in prior migrations); style-eval feature removed
drop table if exists public.style_eval_queries;
