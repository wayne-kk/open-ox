import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { isCreditsEnabled } from "./credits";
import { applyFreeDailyGrant } from "./freeGrant";

/**
 * Ledger mutations always use the service-role client.
 * Callers may pass a user-scoped client; it is ignored for writes (RLS is select-only).
 */
function adminDb(_db?: SupabaseClient): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

export type CreditPlan = "free" | "pro";

export type CreditAccountSnapshot = {
  userId: string;
  balance: number;
  plan: CreditPlan;
  lastDailyGrantDate: string | null;
  freeMonthKey: string | null;
  freeMonthGranted: number;
  proTier: string | null;
  stripeSubscriptionStatus: string | null;
};

export type SpendCreditsInput = {
  userId: string;
  amount: number;
  kind: "spend_generate" | "spend_modify" | "spend_other";
  reason?: string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
};

export type SpendCreditsResult =
  | { ok: true; balance: number; charged: number }
  | { ok: false; code: "INSUFFICIENT" | "DISABLED" | "ERROR"; balance: number; message: string };

type AccountRow = {
  user_id: string;
  balance: number | string;
  plan: string;
  last_daily_grant_date: string | null;
  free_month_key: string | null;
  free_month_granted: number | string;
  pro_tier?: string | null;
  stripe_subscription_status?: string | null;
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function rowToSnapshot(row: AccountRow): CreditAccountSnapshot {
  return {
    userId: row.user_id,
    balance: num(row.balance),
    plan: row.plan === "pro" ? "pro" : "free",
    lastDailyGrantDate: row.last_daily_grant_date,
    freeMonthKey: row.free_month_key,
    freeMonthGranted: num(row.free_month_granted),
    proTier: row.pro_tier ?? null,
    stripeSubscriptionStatus: row.stripe_subscription_status ?? null,
  };
}

async function getOrCreateAccount(
  db: SupabaseClient,
  userId: string
): Promise<AccountRow> {
  const { data, error } = await db
    .from("user_credit_accounts")
    .select(
      "user_id, balance, plan, last_daily_grant_date, free_month_key, free_month_granted, pro_tier, stripe_subscription_status"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`credit account read failed: ${error.message}`);
  if (data) return data as AccountRow;

  const { data: inserted, error: insertError } = await db
    .from("user_credit_accounts")
    .insert({ user_id: userId, balance: 0, plan: "free" })
    .select(
      "user_id, balance, plan, last_daily_grant_date, free_month_key, free_month_granted, pro_tier, stripe_subscription_status"
    )
    .single();
  if (insertError) throw new Error(`credit account create failed: ${insertError.message}`);
  return inserted as AccountRow;
}

/**
 * Ensure Free daily grant for today (UTC). Daily credits do not roll over:
 * on a new day the spendable balance is replaced by today's grant (Free only).
 */
export async function ensureDailyGrant(
  db: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<CreditAccountSnapshot> {
  const admin = adminDb(db);
  let row = await getOrCreateAccount(admin, userId);

  if (row.plan !== "free") {
    return rowToSnapshot(row);
  }

  const transition = applyFreeDailyGrant(
    {
      balance: num(row.balance),
      lastDailyGrantDate: row.last_daily_grant_date,
      freeMonthKey: row.free_month_key,
      freeMonthGranted: num(row.free_month_granted),
    },
    now
  );

  if (!transition.changed) {
    return rowToSnapshot(row);
  }

  const { next, granted } = transition;
  const { data: updated, error } = await admin
    .from("user_credit_accounts")
    .update({
      balance: next.balance,
      last_daily_grant_date: next.lastDailyGrantDate,
      free_month_key: next.freeMonthKey,
      free_month_granted: next.freeMonthGranted,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .select(
      "user_id, balance, plan, last_daily_grant_date, free_month_key, free_month_granted, pro_tier, stripe_subscription_status"
    )
    .single();

  if (error) throw new Error(`daily grant failed: ${error.message}`);
  row = updated as AccountRow;

  if (granted > 0) {
    await admin.from("credit_ledger").insert({
      user_id: userId,
      kind: "grant_daily",
      amount: granted,
      balance_after: next.balance,
      reason: `Free daily grant ${next.lastDailyGrantDate}`,
      metadata: {
        monthKey: next.freeMonthKey,
        monthGranted: next.freeMonthGranted,
      },
    });
  }

  return rowToSnapshot(row);
}

export async function getCreditBalance(
  db: SupabaseClient,
  userId: string
): Promise<CreditAccountSnapshot> {
  return ensureDailyGrant(db, userId);
}

export async function canAfford(
  db: SupabaseClient,
  userId: string,
  minCredits: number
): Promise<{ ok: boolean; balance: number }> {
  if (!isCreditsEnabled()) {
    return { ok: true, balance: 0 };
  }
  const snap = await getCreditBalance(db, userId);
  return { ok: snap.balance >= minCredits, balance: snap.balance };
}

/**
 * Debit credits. When CREDITS_ENABLED is off, returns ok without writing.
 * Amount is rounded to 1 decimal; zero/negative is a no-op success.
 */
export async function spendCredits(
  db: SupabaseClient,
  input: SpendCreditsInput
): Promise<SpendCreditsResult> {
  if (!isCreditsEnabled()) {
    return { ok: true, balance: 0, charged: 0 };
  }

  const admin = adminDb(db);
  const amount = Math.round(Math.max(0, input.amount) * 10) / 10;
  if (amount <= 0) {
    const snap = await getCreditBalance(admin, input.userId);
    return { ok: true, balance: snap.balance, charged: 0 };
  }

  try {
    await ensureDailyGrant(admin, input.userId);
    const row = await getOrCreateAccount(admin, input.userId);
    const balance = num(row.balance);
    if (balance < amount) {
      return {
        ok: false,
        code: "INSUFFICIENT",
        balance,
        message: `Need ${amount} credits, have ${balance}`,
      };
    }
    const next = Math.round((balance - amount) * 100) / 100;
    const { data: updated, error: updErr } = await admin
      .from("user_credit_accounts")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("user_id", input.userId)
      .eq("balance", balance)
      .select("balance")
      .maybeSingle();
    if (updErr) {
      return { ok: false, code: "ERROR", balance, message: updErr.message };
    }
    if (!updated) {
      return {
        ok: false,
        code: "INSUFFICIENT",
        balance,
        message: "Concurrent balance update — retry",
      };
    }

    await admin.from("credit_ledger").insert({
      user_id: input.userId,
      kind: input.kind,
      amount: -amount,
      balance_after: next,
      reason: input.reason ?? null,
      project_id: input.projectId ?? null,
      metadata: input.metadata ?? {},
    });

    return { ok: true, balance: next, charged: amount };
  } catch (err) {
    return {
      ok: false,
      code: "ERROR",
      balance: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
