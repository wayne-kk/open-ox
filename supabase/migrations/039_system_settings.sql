-- Runtime controls managed from the Admin console.

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.system_settings enable row level security;

-- Start in maintenance mode. Runtime reads fail closed if this table is unavailable.
insert into public.system_settings (key, value)
values ('project_creation_maintenance', 'true'::jsonb)
on conflict (key) do nothing;
