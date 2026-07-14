import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

function adminDb(_db?: SupabaseClient): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type GrantKind =
  | "grant_monthly"
  | "grant_topup"
  | "grant_subscription"
  | "grant_adjust"
  | "grant_welcome";

export type GrantCreditsInput = {
  userId: string;
  amount: number;
  kind: GrantKind;
  reason?: string;
  /** Idempotency key stored in ledger metadata (e.g. Stripe invoice id). */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  /** Optional account field patches applied with the grant. */
  accountPatch?: Record<string, unknown>;
};

export type GrantCreditsResult =
  | { ok: true; balance: number; granted: number; duplicate?: boolean }
  | { ok: false; message: string };

/**
 * Add credits to balance (Pro monthly / top-up). Never replaces balance.
 * Idempotent when `idempotencyKey` was already recorded in ledger metadata.
 */
export async function grantCredits(
  db: SupabaseClient | undefined,
  input: GrantCreditsInput
): Promise<GrantCreditsResult> {
  const admin = adminDb(db);
  const amount = Math.round(Math.max(0, input.amount) * 10) / 10;
  if (amount <= 0) {
    return { ok: false, message: "Grant amount must be positive" };
  }

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("credit_ledger")
      .select("id, balance_after")
      .eq("user_id", input.userId)
      .filter("metadata->>idempotencyKey", "eq", input.idempotencyKey)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        balance: num(existing.balance_after),
        granted: 0,
        duplicate: true,
      };
    }
  }

  const { data: row, error: readErr } = await admin
    .from("user_credit_accounts")
    .select("balance")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };

  if (!row) {
    const { error: insErr } = await admin.from("user_credit_accounts").insert({
      user_id: input.userId,
      balance: 0,
      plan: "free",
      ...(input.accountPatch ?? {}),
    });
    if (insErr) return { ok: false, message: insErr.message };
  }

  const { data: current, error: curErr } = await admin
    .from("user_credit_accounts")
    .select("balance")
    .eq("user_id", input.userId)
    .single();
  if (curErr) return { ok: false, message: curErr.message };

  const balance = num(current.balance);
  const next = Math.round((balance + amount) * 100) / 100;

  const { error: updErr } = await admin
    .from("user_credit_accounts")
    .update({
      balance: next,
      updated_at: new Date().toISOString(),
      ...(input.accountPatch ?? {}),
    })
    .eq("user_id", input.userId);
  if (updErr) return { ok: false, message: updErr.message };

  const { error: ledErr } = await admin.from("credit_ledger").insert({
    user_id: input.userId,
    kind: input.kind,
    amount,
    balance_after: next,
    reason: input.reason ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.idempotencyKey
        ? { idempotencyKey: input.idempotencyKey }
        : {}),
    },
  });
  if (ledErr) return { ok: false, message: ledErr.message };

  return { ok: true, balance: next, granted: amount };
}

/** Mark a Stripe event as processed. Returns false if already seen. */
export async function claimStripeEvent(
  eventId: string,
  type: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const admin = createSupabaseServiceRoleClient();
  const { error } = await admin.from("billing_stripe_events").insert({
    event_id: eventId,
    type,
    metadata: metadata ?? {},
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`claimStripeEvent: ${error.message}`);
  }
  return true;
}
