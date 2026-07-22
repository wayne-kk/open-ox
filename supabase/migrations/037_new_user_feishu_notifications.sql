-- At-most-once Feishu operations notification for selected new Auth users.

create table if not exists public.new_user_notifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'email', 'linuxdo')),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'sent', 'failed')),
  registered_at timestamptz not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz
);

alter table public.new_user_notifications enable row level security;

-- No client policies: the Auth trigger inserts candidates and the application
-- service role owns claim/final-state transitions.

create or replace function public.capture_new_user_notification_candidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_provider text;
begin
  -- Custom Feishu OAuth accounts authenticate as synthetic email users.
  if new.raw_user_meta_data ? 'feishu_open_id' then
    return new;
  end if;

  if new.raw_user_meta_data ->> 'provider' = 'linuxdo' then
    normalized_provider := 'linuxdo';
  elsif
    new.raw_app_meta_data ->> 'provider' = 'google'
    or coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  then
    normalized_provider := 'google';
  elsif
    new.raw_user_meta_data ->> 'provider' = 'email'
    or new.raw_app_meta_data ->> 'provider' = 'email'
  then
    normalized_provider := 'email';
  else
    return new;
  end if;

  insert into public.new_user_notifications (user_id, provider, registered_at)
  values (new.id, normalized_provider, new.created_at)
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- Operations notification must never roll back creation of the Auth user.
    raise warning '[new-user-notification] candidate capture failed (SQLSTATE %)', sqlstate;
    return new;
end;
$$;

revoke all on function public.capture_new_user_notification_candidate() from public;

drop trigger if exists capture_new_user_notification_candidate on auth.users;
create trigger capture_new_user_notification_candidate
  after insert on auth.users
  for each row execute function public.capture_new_user_notification_candidate();
