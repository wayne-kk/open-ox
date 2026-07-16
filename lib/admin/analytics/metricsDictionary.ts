import { formatDateKey, startOfUtcDay } from "@/lib/admin/analytics/dateRange";

/** Logged-in DAU: presence of these analytics events on the UTC day. */
export const DAU_EVENT_NAMES = new Set(["page_view", "studio_heartbeat"]);

export const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed"]);

/**
 * Acquisition channel for a registration (UTC day of auth.users.created_at):
 * - utm: any first-touch utm_* on user_acquisition
 * - referral: else external referrer
 * - direct: else row present without marketing signal
 * - unknown: no user_acquisition row
 * See docs/admin-analytics-prd.md §4.0 and docs/adr/0007.
 */
export const ACQUISITION_CHANNELS = ["utm", "referral", "direct", "unknown"] as const;

export function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(startOfUtcDay(date));
}

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

/**
 * DAU per UTC day: distinct logged-in users with page_view or studio_heartbeat.
 * Project/run creation alone does not count.
 */
export function computeDauByDate(params: {
  keys: string[];
  events: Array<{ event_name: string; user_id: string | null; client_ts: string }>;
  allowedUserIds?: Set<string> | null;
}): Map<string, number> {
  const usersByDate = new Map(params.keys.map((key) => [key, new Set<string>()]));

  for (const event of params.events) {
    if (!event.user_id) continue;
    if (params.allowedUserIds && !params.allowedUserIds.has(event.user_id)) continue;
    if (!DAU_EVENT_NAMES.has(event.event_name)) continue;
    const key = dateKeyFromIso(event.client_ts);
    if (!key || !usersByDate.has(key)) continue;
    usersByDate.get(key)?.add(event.user_id);
  }

  return new Map(params.keys.map((key) => [key, usersByDate.get(key)?.size ?? 0]));
}

/**
 * Lifetime first project day per user (UTC date key of earliest projects.created_at).
 */
export function computeFirstProjectDateByUser(
  projects: Array<{ user_id: string | null; created_at: string }>
): Map<string, string> {
  const firstByUser = new Map<string, string>();
  for (const project of projects) {
    if (!project.user_id) continue;
    const key = dateKeyFromIso(project.created_at);
    if (!key) continue;
    const existing = firstByUser.get(project.user_id);
    if (!existing || key < existing) {
      firstByUser.set(project.user_id, key);
    }
  }
  return firstByUser;
}

/**
 * Count users whose milestone date key falls on each day in `keys`.
 */
export function countMilestonesByDate(params: {
  keys: string[];
  milestoneByUser: Map<string, string>;
  allowedUserIds?: Set<string> | null;
}): Map<string, number> {
  const counts = new Map(params.keys.map((key) => [key, 0]));
  for (const [userId, dayKey] of params.milestoneByUser) {
    if (params.allowedUserIds && !params.allowedUserIds.has(userId)) continue;
    if (!counts.has(dayKey)) continue;
    counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
  }
  return counts;
}

/**
 * Terminal success rate for a UTC day, bucketed by finished_at.
 * queued/running excluded from the denominator.
 */
export function computeSuccessRatePercent(
  runs: Array<{ status: string; finished_at: string | null }>,
  dayKey: string
): number {
  let succeeded = 0;
  let terminal = 0;
  for (const run of runs) {
    if (!isTerminalRunStatus(run.status)) continue;
    if (dateKeyFromIso(run.finished_at) !== dayKey) continue;
    terminal += 1;
    if (run.status === "succeeded") succeeded += 1;
  }
  if (terminal === 0) return 0;
  return Math.round((succeeded / terminal) * 1000) / 10;
}

/**
 * Mean of daily terminal success rates over `dayKeys` (empty days count as 0%).
 */
export function averageDailySuccessRatePercent(
  runs: Array<{ status: string; finished_at: string | null }>,
  dayKeys: string[]
): number {
  if (dayKeys.length === 0) return 0;
  const sum = dayKeys.reduce((acc, key) => acc + computeSuccessRatePercent(runs, key), 0);
  return Math.round((sum / dayKeys.length) * 10) / 10;
}

/** Thin helper documenting queue 24h count filter (status + finished_at window). */
export function queueFinishedSinceParams(status: "succeeded" | "failed", sinceIso: string) {
  return { status, finishedSince: sinceIso } as const;
}
