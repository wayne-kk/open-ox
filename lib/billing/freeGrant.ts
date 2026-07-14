/**
 * Pure Free-tier daily grant state machine (no DB).
 * @deprecated Daily Free grants removed — always a no-op. Kept for import stability.
 */

export type FreeGrantState = {
  balance: number;
  lastDailyGrantDate: string | null;
  freeMonthKey: string | null;
  freeMonthGranted: number;
};

export type FreeGrantTransition = {
  next: FreeGrantState;
  granted: number;
  changed: boolean;
};

/** Daily Free grants are disabled; never mutates state. */
export function applyFreeDailyGrant(
  state: FreeGrantState,
  _now: Date = new Date()
): FreeGrantTransition {
  return { next: state, granted: 0, changed: false };
}
