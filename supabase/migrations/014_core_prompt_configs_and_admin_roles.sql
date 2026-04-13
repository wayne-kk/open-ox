-- Core step prompt overrides + admin role gating.
-- Assign an admin manually after migration, for example:
-- insert into public.user_roles (user_id, role) values ('<auth-user-uuid>', 'admin')
-- on conflict (user_id, role) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_role_idx on public.user_roles (role);

create table if not exists public.core_step_prompt_configs (
  step_id text primary key,
  prompt_content text not null,
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
alter table public.core_step_prompt_configs enable row level security;

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
  on public.user_roles for select
  using (user_id = auth.uid());

drop policy if exists "core_step_prompt_configs_select_authenticated" on public.core_step_prompt_configs;
create policy "core_step_prompt_configs_select_authenticated"
  on public.core_step_prompt_configs for select
  using (auth.uid() is not null);

drop policy if exists "core_step_prompt_configs_admin_write" on public.core_step_prompt_configs;
create policy "core_step_prompt_configs_admin_write"
  on public.core_step_prompt_configs for all
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );
