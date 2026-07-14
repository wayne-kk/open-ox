/** Credit conversion and Free-tier constants. */

/** One-time welcome pack on first credit-account ensure (Free trial). */
export const WELCOME_CREDITS = 12;

/** @deprecated Free daily grants removed in welcome-pack Free tier; kept for migration docs/tests. */
export const FREE_DAILY_CREDITS = 5;
/** @deprecated See FREE_DAILY_CREDITS. */
export const FREE_MONTHLY_GRANT_CAP = 30;

/** Default: ~$0.25 per credit (Lovable Pro narrative). Override via CREDITS_USD_PER_CREDIT. */
export function creditUsdRate(): number {
  const raw = Number(process.env.CREDITS_USD_PER_CREDIT);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 0.25;
}

/** Cost multiplier before converting to credits. Override via CREDITS_MARGIN. */
export function creditMargin(): number {
  const raw = Number(process.env.CREDITS_MARGIN);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 1;
}

/**
 * Convert USD model cost to user-facing credits.
 * Rounds up to 1 decimal place. Zero cost → 0. Non-zero floors at 0.1.
 */
export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  const raw = (usd / creditUsdRate()) * creditMargin();
  const rounded = Math.ceil(raw * 10) / 10;
  return Math.max(0.1, rounded);
}

/** @deprecated Daily Free grants removed; always returns 0. */
export function freeDailyGrantAmount(monthGrantedSoFar: number): number {
  void monthGrantedSoFar;
  return 0;
}

/** Ledger idempotency key for the one-time welcome grant. */
export function welcomeGrantIdempotencyKey(userId: string): string {
  return `welcome:${userId}`;
}

/** Ledger idempotency key for legacy Free top-up-to-welcome-floor. */
export function welcomeMigrateIdempotencyKey(userId: string): string {
  return `welcome_migrate_v3:${userId}`;
}

/** UTC calendar date `YYYY-MM-DD`. */
export function utcDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** UTC month key `YYYY-MM`. */
export function utcMonthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export { isCreditsEnabled } from "@/lib/env";

/** Minimum balance to start a full generate (gate). */
export const MIN_GENERATE_CREDITS = 8;

/** Minimum balance to start a modify turn (gate). */
export const MIN_MODIFY_CREDITS = 0.5;

/**
 * Post-run debit amount: never exceed balance (no debt).
 * Requested is rounded to 1 decimal like spendCredits; result is ≥ 0.
 */
export function clampSpendAmount(requested: number, balance: number): number {
  const amount = Math.round(Math.max(0, requested) * 10) / 10;
  const bal = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  if (amount <= 0 || bal <= 0) return 0;
  return Math.min(amount, Math.round(bal * 10) / 10);
}
