/** Credit conversion and Free-tier constants. */

export const FREE_DAILY_CREDITS = 5;
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

/** How many Free daily credits to grant given month-to-date grants. */
export function freeDailyGrantAmount(monthGrantedSoFar: number): number {
  const remaining = FREE_MONTHLY_GRANT_CAP - monthGrantedSoFar;
  if (remaining <= 0) return 0;
  return Math.min(FREE_DAILY_CREDITS, remaining);
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
export const MIN_GENERATE_CREDITS = 2;

/** Minimum balance to start a modify turn (gate). */
export const MIN_MODIFY_CREDITS = 0.5;
