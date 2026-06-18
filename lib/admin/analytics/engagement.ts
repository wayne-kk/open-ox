import {
  formatDateKey,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
  startOfUtcDay,
} from "@/lib/admin/analytics/dateRange";
import { getInternalFilterSummary, loadAnalyticsBase } from "@/lib/admin/analytics/dataLoader";
import {
  bucketSessionDuration,
  buildActivityHeatmap,
  computePageDwellMinutes,
  computeSessions,
  computeModuleDwellMinutes,
  normalizePagePath,
  percentile,
  type DurationBucket,
} from "@/lib/admin/analytics/sessionMetrics";

const BUCKET_ORDER: DurationBucket[] = ["0-1", "1-5", "5-15", "15-30", "30+"];

function userHasModify(projects: { user_id: string | null; modification_history: unknown }[], userId: string): boolean {
  return projects.some((project) => {
    if (project.user_id !== userId) return false;
    return Array.isArray(project.modification_history) && project.modification_history.length > 0;
  });
}

export type EngagementResponse = {
  durationDistribution: Array<{ bucket: DurationBucket; count: number }>;
  pageDwell: Array<{ path: string; avgMinutes: number; sessions: number }>;
  sessionTrend: Array<{ date: string; values: Record<string, number> }>;
  deepSessionTrend: Array<{ date: string; values: Record<string, number> }>;
  heatmap: Array<{ day: number; hour: number; users: number }>;
  moduleDwell: Array<{ module: string; totalMinutes: number }>;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
  internalFilter: ReturnType<typeof getInternalFilterSummary>;
};

export async function fetchEngagement(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
}): Promise<EngagementResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const excludeInternal = params.excludeInternal !== false;

  const data = await loadAnalyticsBase({ from: range.from, to: range.to, excludeInternal });
  const sessions = computeSessions(data.events).filter(
    (session) => session.startDateKey >= keys[0] && session.startDateKey <= keys[keys.length - 1]
  );

  const bucketCounts = Object.fromEntries(BUCKET_ORDER.map((bucket) => [bucket, 0])) as Record<
    DurationBucket,
    number
  >;
  for (const session of sessions) {
    bucketCounts[bucketSessionDuration(session.durationMinutes)] += 1;
  }

  const pageTotals = computePageDwellMinutes(data.events);
  const pageSessions = new Map<string, number>();
  for (const event of data.events) {
    if (event.event_name !== "page_view") continue;
    const path = normalizePagePath(event.properties?.path);
    pageSessions.set(path, (pageSessions.get(path) ?? 0) + 1);
  }

  const pageDwell = [...pageTotals.entries()]
    .map(([path, totalMinutes]) => ({
      path,
      avgMinutes:
        Math.round((totalMinutes / Math.max(1, pageSessions.get(path) ?? 1)) * 10) / 10,
      sessions: pageSessions.get(path) ?? 0,
    }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, 8);

  const trendSeries = Object.fromEntries(
    keys.map((date) => [date, { avgMinutes: 0, p50Minutes: 0, p90Minutes: 0, sessionCount: 0 }])
  );
  const deepSeries = Object.fromEntries(keys.map((date) => [date, { deepRatio: 0, sessions: 0 }]));

  for (const date of keys) {
    const daySessions = sessions.filter((session) => session.startDateKey === date);
    const durations = daySessions.map((session) => session.durationMinutes);
    trendSeries[date].sessionCount = daySessions.length;
    trendSeries[date].avgMinutes =
      durations.length === 0
        ? 0
        : Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
    trendSeries[date].p50Minutes = percentile(durations, 0.5);
    trendSeries[date].p90Minutes = percentile(durations, 0.9);

    let deep = 0;
    for (const session of daySessions) {
      if (session.durationMinutes <= 10 || !session.userId) continue;
      if (userHasModify(data.projects, session.userId)) deep += 1;
    }
    deepSeries[date].sessions = daySessions.length;
    deepSeries[date].deepRatio =
      daySessions.length === 0 ? 0 : Math.round((deep / daySessions.length) * 1000) / 10;
  }

  return {
    durationDistribution: BUCKET_ORDER.map((bucket) => ({
      bucket,
      count: bucketCounts[bucket],
    })),
    pageDwell,
    moduleDwell: [...computeModuleDwellMinutes(data.events).entries()]
      .map(([module, totalMinutes]) => ({
        module,
        totalMinutes: Math.round(totalMinutes * 10) / 10,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes),
    sessionTrend: seriesToPoints(trendSeries, keys),
    deepSessionTrend: seriesToPoints(deepSeries, keys),
    heatmap: buildActivityHeatmap(data.events),
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
    internalFilter: getInternalFilterSummary(data),
  };
}

export function engagementToCsv(data: EngagementResponse): string {
  const lines = [
    "bucket,count",
    ...data.durationDistribution.map((row) => `${row.bucket},${row.count}`),
    "",
    "path,avg_minutes,sessions",
    ...data.pageDwell.map((row) => `${row.path},${row.avgMinutes},${row.sessions}`),
  ];
  return lines.join("\n");
}
