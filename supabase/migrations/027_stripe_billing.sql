-- Stripe / Pro / top-up fields on credit accounts + processed webhook events

alter table public.user_credit_accounts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists pro_tier text,
  add column if not exists last_monthly_grant_key text;

create unique index if not exists user_credit_accounts_stripe_customer_id_uidx
  on public.user_credit_accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.billing_stripe_events (
  event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.billing_stripe_events enable row level security;
-- No policies: service role only
