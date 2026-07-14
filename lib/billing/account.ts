import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  WELCOME_CREDITS,
  clampSpendAmount,
  isCreditsEnabled,
  welcomeGrantIdempotencyKey,
  welcomeMigrateIdempotencyKey,
} from "./credits";
import { grantCredits } from "./grants";

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

async function ledgerHasIdempotencyKey(
  db: SupabaseClient,
  userId: string,
  idempotencyKey: string
): Promise<boolean> {
  const { data } = await db
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .filter("metadata->>idempotencyKey", "eq", idempotencyKey)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** True if user ever received paid Stripe-style grants. */
export async function userHasPaidCreditGrants(
  db: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await db
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .in("kind", ["grant_subscription", "grant_topup", "grant_monthly"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * How many credits to add to reach the welcome floor (0 if none).
 * Pure helper for tests / ensure path.
 */
export function welcomeTopUpAmount(input: {
  balance: number;
  plan: CreditPlan;
  hasPaidGrants: boolean;
  welcomeAlreadyApplied: boolean;
}): number {
  if (input.welcomeAlreadyApplied) return 0;
  if (input.plan !== "free" || input.hasPaidGrants) return 0;
  if (input.balance >= WELCOME_CREDITS) return 0;
  return Math.round((WELCOME_CREDITS - input.balance) * 10) / 10;
}

/**
 * Ensure credit account exists; apply one-time welcome / legacy top-up-to-12 when enabled.
 * Free daily grants are not applied.
 */
export async function ensureCreditAccount(
  db: SupabaseClient,
  userId: string
): Promise<CreditAccountSnapshot> {
  const admin = adminDb(db);
  let row = await getOrCreateAccount(admin, userId);

  if (isCreditsEnabled()) {
    const welcomeKey = welcomeGrantIdempotencyKey(userId);
    const migrateKey = welcomeMigrateIdempotencyKey(userId);
    const welcomeAlreadyApplied =
      (await ledgerHasIdempotencyKey(admin, userId, welcomeKey)) ||
      (await ledgerHasIdempotencyKey(admin, userId, migrateKey));
    const hasPaid = await userHasPaidCreditGrants(admin, userId);
    const plan: CreditPlan = row.plan === "pro" ? "pro" : "free";
    const balance = num(row.balance);
    const topUp = welcomeTopUpAmount({
      balance,
      plan,
      hasPaidGrants: hasPaid,
      welcomeAlreadyApplied,
    });

    if (topUp > 0) {
      const isFreshWelcome = balance <= 0;
      const result = await grantCredits(admin, {
        userId,
        amount: topUp,
        kind: isFreshWelcome ? "grant_welcome" : "grant_adjust",
        reason: isFreshWelcome
          ? "Welcome credits"
          : "Legacy Free top-up to welcome floor",
        idempotencyKey: isFreshWelcome ? welcomeKey : migrateKey,
      });
      if (!result.ok) {
        console.warn(`[credits] welcome/migrate failed user=${userId}: ${result.message}`);
      } else if (isFreshWelcome === false && result.granted > 0) {
        // Prevent a later empty-balance welcome from firing after migrate.
        if (!(await ledgerHasIdempotencyKey(admin, userId, welcomeKey))) {
          await admin.from("credit_ledger").insert({
            user_id: userId,
            kind: "grant_welcome",
            amount: 0,
            balance_after: result.balance,
            reason: "Welcome marked after legacy migrate",
            metadata: { idempotencyKey: welcomeKey },
          });
        }
      }
    } else if (!welcomeAlreadyApplied && (plan !== "free" || hasPaid || balance >= WELCOME_CREDITS)) {
      // Mark ineligible / already-above-floor accounts so we never top up later after spend.
      await admin.from("credit_ledger").insert({
        user_id: userId,
        kind: "grant_welcome",
        amount: 0,
        balance_after: balance,
        reason: "Welcome not applicable",
        metadata: { idempotencyKey: welcomeKey },
      });
    }

    row = await getOrCreateAccount(admin, userId);
  }

  return rowToSnapshot(row);
}

/** @deprecated Use ensureCreditAccount — daily Free grants removed. */
export async function ensureDailyGrant(
  db: SupabaseClient,
  userId: string,
  _now?: Date
): Promise<CreditAccountSnapshot> {
  return ensureCreditAccount(db, userId);
}

export async function getCreditBalance(
  db: SupabaseClient,
  userId: string
): Promise<CreditAccountSnapshot> {
  return ensureCreditAccount(db, userId);
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
 * When requested usage exceeds balance, charges only the remaining balance (no debt).
 */
export async function spendCredits(
  db: SupabaseClient,
  input: SpendCreditsInput
): Promise<SpendCreditsResult> {
  if (!isCreditsEnabled()) {
    return { ok: true, balance: 0, charged: 0 };
  }

  const admin = adminDb(db);
  const requested = Math.round(Math.max(0, input.amount) * 10) / 10;
  if (requested <= 0) {
    const snap = await getCreditBalance(admin, input.userId);
    return { ok: true, balance: snap.balance, charged: 0 };
  }

  try {
    await ensureCreditAccount(admin, input.userId);
    const row = await getOrCreateAccount(admin, input.userId);
    const balance = num(row.balance);
    const amount = clampSpendAmount(requested, balance);
    if (amount <= 0) {
      return { ok: true, balance, charged: 0 };
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
