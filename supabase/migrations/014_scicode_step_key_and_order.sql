-- Align SciCode sub-step schema with string step ids like "10.1"
-- Keep existing integer step_number for backward compatibility.

alter table scicode_sub_steps
  add column if not exists step_key text,
  add column if not exists step_order double precision;

-- Backfill from legacy integer step_number.
update scicode_sub_steps
set
  step_key = coalesce(step_key, step_number::text),
  step_order = coalesce(step_order, step_number::double precision)
where step_key is null or step_order is null;

alter table scicode_sub_steps
  alter column step_key set not null,
  alter column step_order set not null;

create unique index if not exists scicode_sub_steps_problem_step_key_uniq
  on scicode_sub_steps (problem_id, step_key);

create index if not exists scicode_sub_steps_problem_step_order_idx
  on scicode_sub_steps (problem_id, step_order asc);

