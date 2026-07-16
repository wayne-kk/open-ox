-- User preferences: onboarding JSONB (new-user onboarding v0.1)

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy user_preferences_select_own
  on public.user_preferences for select
  using (user_id = (select auth.uid()));

create policy user_preferences_insert_own
  on public.user_preferences for insert
  with check (user_id = (select auth.uid()));

create policy user_preferences_update_own
  on public.user_preferences for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
