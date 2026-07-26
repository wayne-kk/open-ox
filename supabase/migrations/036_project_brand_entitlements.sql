-- Per-project permanent removal of the public "Made with Open OX" brand entry.

alter table public.projects
  add column if not exists branding_attribution_token uuid not null default gen_random_uuid();

create unique index if not exists projects_branding_attribution_token_idx
  on public.projects (branding_attribution_token);

create table if not exists public.project_brand_entitlements (
  project_id text primary key references public.projects (id) on delete cascade,
  purchased_by uuid not null references auth.users (id) on delete restrict,
  charged_credits numeric(12, 2) not null check (charged_credits > 0),
  ledger_id uuid not null unique references public.credit_ledger (id) on delete restrict,
  purchase_idempotency_key text not null,
  purchased_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (purchased_by, purchase_idempotency_key)
);

alter table public.project_brand_entitlements enable row level security;

create policy project_brand_entitlements_select_own
  on public.project_brand_entitlements for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create or replace function public.purchase_project_brand_removal(
  target_project_id text,
  target_user_id uuid,
  purchase_idempotency_key text,
  price_credits numeric
)
returns table(charged numeric, balance numeric, purchased boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric;
  next_balance numeric;
  new_ledger_id uuid;
begin
  if price_credits is distinct from 80::numeric then
    raise exception 'INVALID_BRAND_REMOVAL_PRICE';
  end if;
  if nullif(trim(purchase_idempotency_key), '') is null then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if not exists (
    select 1 from public.projects
    where id = target_project_id and user_id = target_user_id and deleted_at is null
  ) then
    raise exception 'PROJECT_NOT_OWNED';
  end if;

  select a.balance into current_balance
  from public.user_credit_accounts a
  where a.user_id = target_user_id
  for update;

  if exists (
    select 1 from public.project_brand_entitlements e
    where e.project_id = target_project_id and e.revoked_at is null
  ) then
    return query select 0::numeric, current_balance, false;
    return;
  end if;

  if current_balance is null or current_balance < price_credits then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  if exists (
    select 1 from public.project_brand_entitlements e
    where e.purchased_by = target_user_id
      and e.purchase_idempotency_key = purchase_project_brand_removal.purchase_idempotency_key
  ) then
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;

  next_balance := current_balance - price_credits;
  update public.user_credit_accounts
  set balance = next_balance, updated_at = now()
  where user_id = target_user_id;

  insert into public.credit_ledger (
    user_id, kind, amount, balance_after, reason, project_id, metadata
  ) values (
    target_user_id,
    'spend_brand_removal',
    -price_credits,
    next_balance,
    'Permanent Made with Open OX removal',
    target_project_id,
    jsonb_build_object('idempotencyKey', purchase_idempotency_key, 'priceUsd', 20)
  ) returning id into new_ledger_id;

  insert into public.project_brand_entitlements (
    project_id, purchased_by, charged_credits, ledger_id, purchase_idempotency_key
  ) values (
    target_project_id, target_user_id, price_credits, new_ledger_id, purchase_idempotency_key
  )
  on conflict (project_id) do update set
    purchased_by = excluded.purchased_by,
    charged_credits = excluded.charged_credits,
    ledger_id = excluded.ledger_id,
    purchase_idempotency_key = excluded.purchase_idempotency_key,
    purchased_at = now(),
    revoked_at = null;

  return query select price_credits, next_balance, true;
end;
$$;

revoke all on function public.purchase_project_brand_removal(text, uuid, text, numeric) from public;
revoke all on function public.purchase_project_brand_removal(text, uuid, text, numeric) from anon;
revoke all on function public.purchase_project_brand_removal(text, uuid, text, numeric) from authenticated;
grant execute on function public.purchase_project_brand_removal(text, uuid, text, numeric) to service_role;
