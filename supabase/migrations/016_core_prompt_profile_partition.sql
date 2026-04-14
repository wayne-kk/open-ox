-- Partition core prompt overrides by prompt profile (web/app).
-- Existing rows are treated as web overrides for backward compatibility.

alter table public.core_step_prompt_configs
  add column if not exists prompt_profile text;

update public.core_step_prompt_configs
set prompt_profile = 'web'
where prompt_profile is null;

alter table public.core_step_prompt_configs
  alter column prompt_profile set default 'web';

alter table public.core_step_prompt_configs
  alter column prompt_profile set not null;

alter table public.core_step_prompt_configs
  drop constraint if exists core_step_prompt_configs_prompt_profile_check;

alter table public.core_step_prompt_configs
  add constraint core_step_prompt_configs_prompt_profile_check
  check (prompt_profile in ('web', 'app'));

alter table public.core_step_prompt_configs
  drop constraint if exists core_step_prompt_configs_pkey;

alter table public.core_step_prompt_configs
  add constraint core_step_prompt_configs_pkey primary key (prompt_profile, step_id);

create index if not exists core_step_prompt_configs_profile_idx
  on public.core_step_prompt_configs (prompt_profile);
