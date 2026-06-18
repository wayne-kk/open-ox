import {
  formatDateKey,
  listDateKeys,
  parseDateRange,
  startOfUtcDay,
} from "@/lib/admin/analytics/dateRange";
import type { AnalyticsBaseData } from "@/lib/admin/analytics/dataLoader";
import { getInternalFilterSummary, loadAnalyticsBase } from "@/lib/admin/analytics/dataLoader";
import { buildUserMilestones } from "@/lib/admin/analytics/funnel";

const RETENTION_DAYS = [1, 7, 14, 30] as const;

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(startOfUtcDay(date));
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function startOfUtcWeek(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return formatDateKey(date);
}

export function buildUserActiveDates(data: AnalyticsBaseData): Map<string, Set<string>> {
  const active = new Map<string, Set<string>>();

  const touch = (userId: string | null | undefined, iso: string | null | undefined) => {
    if (!userId) return;
    const key = dateKeyFromIso(iso);
    if (!key) return;
    const set = active.get(userId) ?? new Set<string>();
    set.add(key);
    active.set(userId, set);
  };

  for (const event of data.events) {
    if (event.event_name === "page_view" || event.event_name === "studio_heartbeat") {
      touch(event.user_id, event.client_ts);
    }
  }
  for (const project of data.projects) {
    touch(project.user_id, project.created_at);
    touch(project.user_id, project.completed_at);
  }
  for (const run of data.runs) {
    touch(run.user_id, run.created_at);
    touch(run.user_id, run.started_at);
    touch(run.user_id, run.finished_at);
  }

  return active;
}

export type RetentionCohortRow = {
  cohortWeek: string;
  cohortSize: number;
  retention: Record<(typeof RETENTION_DAYS)[number], number>;
};

export type RetentionResponse = {
  anchor: "registration" | "firstReady";
  cohorts: RetentionCohortRow[];
  curves: Array<{ date: string; values: Record<string, number> }>;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
  internalFilter: ReturnType<typeof getInternalFilterSummary>;
};

export async function fetchRetentionMatrix(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
  anchor?: "registration" | "firstReady";
}): Promise<RetentionResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const excludeInternal = params.excludeInternal !== false;
  const anchor = params.anchor ?? "registration";

  const data = await loadAnalyticsBase({
    from: range.from,
    to: range.to,
    excludeInternal,
    eventsTo: new Date(range.to.getTime() + 31 * 86_400_000),
  });

  const milestones = buildUserMilestones(data);
  const activeDates = buildUserActiveDates(data);

  const anchorDateByUser = new Map<string, string>();
  for (const row of milestones) {
    const anchorDate = anchor === "firstReady" ? row.firstReadyAt : row.registeredAt;
    if (!anchorDate) continue;
    if (anchor === "firstReady" && !row.firstReadyAt) continue;
    anchorDateByUser.set(row.userId, anchorDate);
  }

  const cohortUsers = new Map<string, string[]>();
  for (const [userId, anchorDate] of anchorDateByUser) {
    if (anchorDate < keys[0] || anchorDate > keys[keys.length - 1]) continue;
    const week = startOfUtcWeek(anchorDate);
    const list = cohortUsers.get(week) ?? [];
    list.push(userId);
    cohortUsers.set(week, list);
  }

  const cohortWeeks = [...cohortUsers.keys()].sort();
  const cohorts: RetentionCohortRow[] = cohortWeeks.map((cohortWeek) => {
    const userIds = cohortUsers.get(cohortWeek) ?? [];
    const cohortSize = userIds.length;
    const retention = Object.fromEntries(
      RETENTION_DAYS.map((day) => {
        if (cohortSize === 0) return [day, 0];
        let retained = 0;
        for (const userId of userIds) {
          const anchorDate = anchorDateByUser.get(userId);
          if (!anchorDate) continue;
          const targetDay = addDays(anchorDate, day);
          const active = activeDates.get(userId);
          if (active?.has(targetDay)) retained += 1;
        }
        return [day, Math.round((retained / cohortSize) * 1000) / 10];
      })
    ) as RetentionCohortRow["retention"];

    return { cohortWeek, cohortSize, retention };
  });

  const curves = cohorts.map((cohort) => ({
    date: cohort.cohortWeek.slice(5),
    values: {
      d1: cohort.retention[1],
      d7: cohort.retention[7],
      d14: cohort.retention[14],
      d30: cohort.retention[30],
    },
  }));

  return {
    anchor,
    cohorts,
    curves,
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
    internalFilter: getInternalFilterSummary(data),
  };
}

export function retentionToCsv(data: RetentionResponse): string {
  const header = "cohort_week,cohort_size,d1,d7,d14,d30";
  const rows = data.cohorts.map(
    (cohort) =>
      `${cohort.cohortWeek},${cohort.cohortSize},${cohort.retention[1]},${cohort.retention[7]},${cohort.retention[14]},${cohort.retention[30]}`
  );
  return [header, ...rows].join("\n");
}
