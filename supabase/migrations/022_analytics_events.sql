-- Analytics events for admin dashboard (engagement, funnel, retention)

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  anonymous_id text not null,
  session_id text not null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  client_ts timestamptz not null,
  server_ts timestamptz not null default now(),
  user_agent text
);

create index if not exists analytics_events_client_ts_idx
  on public.analytics_events (client_ts desc);

create index if not exists analytics_events_event_name_client_ts_idx
  on public.analytics_events (event_name, client_ts desc);

create index if not exists analytics_events_user_id_client_ts_idx
  on public.analytics_events (user_id, client_ts desc);

create index if not exists analytics_events_session_id_client_ts_idx
  on public.analytics_events (session_id, client_ts desc);

alter table public.analytics_events enable row level security;

-- No policies for authenticated users: inserts via service role API only.

create table if not exists public.analytics_daily_rollups (
  date date not null,
  metric_key text not null,
  dimensions jsonb not null default '{}'::jsonb,
  value numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (date, metric_key, dimensions)
);

create index if not exists analytics_daily_rollups_metric_date_idx
  on public.analytics_daily_rollups (metric_key, date desc);

alter table public.analytics_daily_rollups enable row level security;
