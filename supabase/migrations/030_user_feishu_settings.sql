-- Feishu Modify MVP: per-user active project pointer + open_id index for Bot

create table if not exists public.user_feishu_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_project_id text references public.projects (id) on delete set null,
  feishu_open_id text unique,
  updated_at timestamptz not null default now()
);

create index if not exists user_feishu_settings_active_project_id_idx
  on public.user_feishu_settings (active_project_id)
  where active_project_id is not null;

alter table public.user_feishu_settings enable row level security;

create policy user_feishu_settings_select_own
  on public.user_feishu_settings for select
  using (user_id = (select auth.uid()));

create policy user_feishu_settings_insert_own
  on public.user_feishu_settings for insert
  with check (user_id = (select auth.uid()));

create policy user_feishu_settings_update_own
  on public.user_feishu_settings for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_feishu_settings_delete_own
  on public.user_feishu_settings for delete
  using (user_id = (select auth.uid()));
