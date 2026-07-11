/**
 * Pure Free-tier daily grant state machine (no DB).
 * Used by ensureDailyGrant and unit tests.
 */

import { freeDailyGrantAmount, utcDateKey, utcMonthKey } from "./credits";

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

export function applyFreeDailyGrant(
  state: FreeGrantState,
  now: Date = new Date()
): FreeGrantTransition {
  const today = utcDateKey(now);
  const month = utcMonthKey(now);

  if (state.lastDailyGrantDate === today) {
    return { next: state, granted: 0, changed: false };
  }

  let monthGranted = state.freeMonthGranted;
  let monthKey = state.freeMonthKey;
  if (monthKey !== month) {
    monthKey = month;
    monthGranted = 0;
  }

  const granted = freeDailyGrantAmount(monthGranted);
  return {
    changed: true,
    granted,
    next: {
      // Replace up to daily grant, but never wipe leftover paid/Pro credits.
      balance: Math.max(granted, state.balance),
      lastDailyGrantDate: today,
      freeMonthKey: monthKey,
      freeMonthGranted: monthGranted + granted,
    },
  };
}
