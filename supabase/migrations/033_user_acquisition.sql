-- First-touch acquisition profile per user (marketing attribution)

create table if not exists public.user_acquisition (
  user_id uuid primary key references auth.users (id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  captured_at timestamptz,
  bound_at timestamptz not null default now(),
  anonymous_id text,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists user_acquisition_utm_source_idx
  on public.user_acquisition (utm_source);

create index if not exists user_acquisition_utm_campaign_idx
  on public.user_acquisition (utm_campaign);

create index if not exists user_acquisition_bound_at_idx
  on public.user_acquisition (bound_at desc);

alter table public.user_acquisition enable row level security;

-- No client policies: reads/writes via service role (auth callback + admin analytics).
