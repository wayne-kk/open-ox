-- Allow any signed-in user to read all projects (listing / collaboration).
-- Writes remain scoped to owner via existing policies.
drop policy if exists "projects_select_own" on projects;

create policy "projects_select_authenticated"
  on projects for select
  using ( auth.uid() is not null );

-- Denormalized owner label for grouping in the global project list (set on insert).
alter table projects add column if not exists owner_username text;

-- Backfill from auth.users where possible (migration runs as superuser).
update public.projects p
set owner_username = coalesce(
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(trim(u.raw_user_meta_data->>'name'), ''),
  nullif(trim(u.raw_user_meta_data->>'preferred_username'), ''),
  case
    when u.email is not null and u.email not like '%@feishu.open-ox.local'
    then split_part(u.email, '@', 1)
    else null
  end,
  left(replace(p.user_id::text, '-', ''), 8)
)
from auth.users u
where u.id = p.user_id
  and (p.owner_username is null or trim(p.owner_username) = '');
