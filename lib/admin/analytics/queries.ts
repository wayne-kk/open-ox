import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { loadAnalyticsAudience } from "@/lib/admin/analytics/dataLoader";
import {
  computeKpiSnapshot,
  emptySeries,
  formatDateKey,
  incrementSeries,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
  startOfUtcDay,
} from "@/lib/admin/analytics/dateRange";
import {
  averageDailySuccessRatePercent,
  computeDauByDate,
  computeFirstProjectDateByUser,
  computeSuccessRatePercent,
  countMilestonesByDate,
  dateKeyFromIso,
  queueFinishedSinceParams,
} from "@/lib/admin/analytics/metricsDictionary";
import type {
  OverviewCharts,
  OverviewKpis,
  OverviewResponse,
  QueueHealthResponse,
} from "@/lib/admin/analytics/types";

interface ProjectRow {
  id: string;
  user_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_duration: number | null;
}

interface GenerationRunRow {
  id: string;
  project_id: string;
  user_id: string | null;
  status: string;
  kind: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

interface AnalyticsEventRow {
  event_name: string;
  user_id: string | null;
  client_ts: string;
}

function durationMinutes(
  startedAt: string | null,
  finishedAt: string | null,
): number | null {
  if (!startedAt || !finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return (end - start) / 60_000;
}

function buildMaps(keys: string[]) {
  return new Map(keys.map((key) => [key, 0]));
}

function rangeEndIso(to: Date): string {
  return new Date(to.getTime() + 86_399_999).toISOString();
}

export async function fetchAdminOverview(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
}): Promise<OverviewResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const todayKey = formatDateKey(startOfUtcDay(new Date()));
  const excludeInternal = params.excludeInternal !== false;
  const rangeEnd = rangeEndIso(range.to);

  const service = createSupabaseServiceRoleClient();

  const [
    audience,
    eventsQuery,
    projectsResult,
    runsCreatedResult,
    runsFinishedResult,
    allProjectsForFirst,
    readyProjectsResult,
  ] = await Promise.all([
    loadAnalyticsAudience({ excludeInternal }),
    service
      .from("analytics_events")
      .select("event_name, user_id, client_ts")
      .gte("client_ts", range.from.toISOString())
      .lte("client_ts", rangeEnd),
    service
      .from("projects")
      .select("id, user_id, status, created_at, completed_at, total_duration")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", rangeEnd),
    service
      .from("generation_runs")
      .select(
        "id, project_id, user_id, status, kind, created_at, started_at, finished_at, error",
      )
      .gte("created_at", range.from.toISOString())
      .lte("created_at", rangeEnd),
    service
      .from("generation_runs")
      .select(
        "id, project_id, user_id, status, kind, created_at, started_at, finished_at, error",
      )
      .in("status", ["succeeded", "failed"])
      .gte("finished_at", range.from.toISOString())
      .lte("finished_at", rangeEnd),
    service
      .from("projects")
      .select("user_id, created_at")
      .not("user_id", "is", null),
    service
      .from("projects")
      .select("user_id, completed_at, created_at, status")
      .eq("status", "ready")
      .not("user_id", "is", null),
  ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (runsCreatedResult.error) throw new Error(runsCreatedResult.error.message);
  if (runsFinishedResult.error)
    throw new Error(runsFinishedResult.error.message);
  if (allProjectsForFirst.error)
    throw new Error(allProjectsForFirst.error.message);

  const events = eventsQuery.error
    ? []
    : ((eventsQuery.data ?? []) as AnalyticsEventRow[]);

  const projects = (projectsResult.data ?? []) as ProjectRow[];
  const runsById = new Map<string, GenerationRunRow>();
  for (const run of (runsCreatedResult.data ?? []) as GenerationRunRow[]) {
    runsById.set(run.id, run);
  }
  for (const run of (runsFinishedResult.data ?? []) as GenerationRunRow[]) {
    runsById.set(run.id, run);
  }
  const runs = [...runsById.values()];

  const allUsers = audience.users;
  const allowedUserIds = new Set(allUsers.map((user) => user.id));
  const registrationSeries = emptySeries(keys, ["registrations"]);
  const projectSeries = emptySeries(keys, ["created", "ready", "failed"]);
  const durationSeries = emptySeries(keys, [
    "p50Minutes",
    "avgMinutes",
    "sampleCount",
  ]);
  const activationSeries = emptySeries(keys, [
    "registered",
    "firstProject",
    "firstReady",
  ]);

  for (const user of allUsers) {
    const key = dateKeyFromIso(user.created_at);
    if (key && registrationSeries[key]) {
      incrementSeries(registrationSeries, key, "registrations");
      incrementSeries(activationSeries, key, "registered");
    }
  }

  const firstReadyByUser = new Map<string, string>();
  for (const row of readyProjectsResult.data ?? []) {
    const userId = (row as { user_id: string }).user_id;
    if (!allowedUserIds.has(userId)) continue;
    const readyKey = dateKeyFromIso(
      (row as { completed_at: string | null }).completed_at ??
        (row as { created_at: string }).created_at,
    );
    if (!readyKey) continue;
    const existing = firstReadyByUser.get(userId);
    if (!existing || readyKey < existing) {
      firstReadyByUser.set(userId, readyKey);
    }
  }

  for (const [, readyKey] of firstReadyByUser) {
    if (activationSeries[readyKey]) {
      incrementSeries(activationSeries, readyKey, "firstReady");
    }
  }

  const firstProjectByUser = computeFirstProjectDateByUser(
    (allProjectsForFirst.data ?? []) as Array<{
      user_id: string | null;
      created_at: string;
    }>,
  );
  const firstProjectCounts = countMilestonesByDate({
    keys,
    milestoneByUser: firstProjectByUser,
    allowedUserIds,
  });
  for (const [dayKey, count] of firstProjectCounts) {
    if (activationSeries[dayKey] && count > 0) {
      activationSeries[dayKey].firstProject = count;
    }
  }

  for (const project of projects) {
    if (project.user_id && !allowedUserIds.has(project.user_id)) continue;
    const createdKey = dateKeyFromIso(project.created_at);
    if (createdKey && projectSeries[createdKey]) {
      incrementSeries(projectSeries, createdKey, "created");
    }
    if (project.status === "ready") {
      const readyKey = dateKeyFromIso(
        project.completed_at ?? project.created_at,
      );
      if (readyKey && projectSeries[readyKey]) {
        incrementSeries(projectSeries, readyKey, "ready");
      }
    }
    if (project.status === "failed") {
      const failedKey = dateKeyFromIso(project.created_at);
      if (failedKey && projectSeries[failedKey]) {
        incrementSeries(projectSeries, failedKey, "failed");
      }
    }
  }

  const dauByDate = computeDauByDate({
    keys,
    events,
    allowedUserIds,
  });

  const durationsByDate = new Map<string, number[]>();
  for (const run of runs) {
    if (run.user_id && !allowedUserIds.has(run.user_id)) continue;
    const minutes = durationMinutes(run.started_at, run.finished_at);
    const key = dateKeyFromIso(
      run.finished_at ?? run.started_at ?? run.created_at,
    );
    if (minutes != null && key) {
      const bucket = durationsByDate.get(key) ?? [];
      bucket.push(minutes);
      durationsByDate.set(key, bucket);
    }
  }

  for (const [key, values] of durationsByDate) {
    if (!durationSeries[key] || values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    durationSeries[key].p50Minutes = Math.round(p50 * 10) / 10;
    durationSeries[key].avgMinutes = Math.round(avg * 10) / 10;
    durationSeries[key].sampleCount = values.length;
  }

  const registrationMap = new Map(
    keys.map((key) => [key, registrationSeries[key]?.registrations ?? 0]),
  );
  const projectCreatedMap = new Map(
    keys.map((key) => [key, projectSeries[key]?.created ?? 0]),
  );
  const firstReadyMap = buildMaps(keys);
  for (const [, readyKey] of firstReadyByUser) {
    if (firstReadyMap.has(readyKey)) {
      firstReadyMap.set(readyKey, (firstReadyMap.get(readyKey) ?? 0) + 1);
    }
  }

  const filteredRunsForSuccess = runs.filter(
    (run) => !run.user_id || allowedUserIds.has(run.user_id),
  );

  const yesterday = new Date(`${todayKey}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const successRateToday = computeSuccessRatePercent(
    filteredRunsForSuccess,
    todayKey,
  );
  const successRateYesterday = computeSuccessRatePercent(
    filteredRunsForSuccess,
    yesterdayKey,
  );
  const avgSuccess7d = averageDailySuccessRatePercent(
    filteredRunsForSuccess,
    keys.slice(-7),
  );

  const avgGenToday = durationSeries[todayKey]?.avgMinutes ?? 0;

  const charts: OverviewCharts = {
    userGrowth: seriesToPoints(
      Object.fromEntries(
        keys.map((key) => [
          key,
          {
            registrations: registrationSeries[key]?.registrations ?? 0,
            dau: dauByDate.get(key) ?? 0,
          },
        ]),
      ),
      keys,
    ),
    projectProduction: seriesToPoints(projectSeries, keys),
    generationDuration: seriesToPoints(durationSeries, keys),
    activationFunnel: seriesToPoints(activationSeries, keys),
  };

  const kpis: OverviewKpis = {
    newRegistrations: computeKpiSnapshot(registrationMap, todayKey),
    dau: computeKpiSnapshot(dauByDate, todayKey),
    newProjects: computeKpiSnapshot(projectCreatedMap, todayKey),
    firstReadyUsers: computeKpiSnapshot(firstReadyMap, todayKey),
    generationSuccessRate: {
      today: successRateToday,
      yesterday: successRateYesterday,
      avg7d: avgSuccess7d,
    },
    avgGenerationMinutes: {
      today: avgGenToday,
      yesterday: durationSeries[yesterdayKey]?.avgMinutes ?? 0,
      avg7d:
        Math.round(
          (keys
            .slice(-7)
            .reduce(
              (sum, key) => sum + (durationSeries[key]?.avgMinutes ?? 0),
              0,
            ) /
            7) *
            10,
        ) / 10,
    },
  };

  return {
    kpis,
    charts,
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
  };
}

export async function fetchQueueHealth(): Promise<QueueHealthResponse> {
  const service = createSupabaseServiceRoleClient();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const succeededFilter = queueFinishedSinceParams("succeeded", since24h);
  const failedFilter = queueFinishedSinceParams("failed", since24h);

  const [
    queuedResult,
    runningResult,
    succeeded24hResult,
    failed24hResult,
    recentResult,
    failedDetailsResult,
  ] = await Promise.all([
    service
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
    service
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    service
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", succeededFilter.status)
      .gte("finished_at", succeededFilter.finishedSince),
    service
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", failedFilter.status)
      .gte("finished_at", failedFilter.finishedSince),
    service
      .from("generation_runs")
      .select(
        "id, project_id, user_id, status, kind, created_at, started_at, finished_at, error",
      )
      .in("status", ["queued", "running", "succeeded", "failed"])
      .order("created_at", { ascending: false })
      .limit(30),
    service
      .from("generation_runs")
      .select("id, project_id, error, finished_at")
      .eq("status", "failed")
      .gte("finished_at", since24h)
      .order("finished_at", { ascending: false })
      .limit(10),
  ]);

  if (recentResult.error) throw new Error(recentResult.error.message);
  if (succeeded24hResult.error)
    throw new Error(succeeded24hResult.error.message);
  if (failed24hResult.error) throw new Error(failed24hResult.error.message);

  const recentRuns = (recentResult.data ?? []) as GenerationRunRow[];
  const waitSamples = recentRuns
    .map((run) => {
      if (!run.started_at) return null;
      const waitSeconds = Math.round(
        (new Date(run.started_at).getTime() -
          new Date(run.created_at).getTime()) /
          1000,
      );
      return waitSeconds >= 0 ? waitSeconds : null;
    })
    .filter((value): value is number => value != null);

  return {
    counts: {
      queued: queuedResult.count ?? 0,
      running: runningResult.count ?? 0,
      succeeded24h: succeeded24hResult.count ?? 0,
      failed24h: failed24hResult.count ?? 0,
    },
    avgWaitSeconds:
      waitSamples.length > 0
        ? Math.round(
            waitSamples.reduce((sum, value) => sum + value, 0) /
              waitSamples.length,
          )
        : null,
    recentRuns: recentRuns.slice(0, 15).map((run) => ({
      id: run.id,
      projectId: run.project_id,
      userId: run.user_id,
      status: run.status,
      kind: run.kind,
      createdAt: run.created_at,
      startedAt: run.started_at,
      waitSeconds:
        run.started_at != null
          ? Math.max(
              0,
              Math.round(
                (new Date(run.started_at).getTime() -
                  new Date(run.created_at).getTime()) /
                  1000,
              ),
            )
          : null,
    })),
    recentErrors: (failedDetailsResult.data ?? [])
      .filter((row) => (row as { error: string | null }).error)
      .map((row) => ({
        runId: (row as { id: string }).id,
        projectId: (row as { project_id: string }).project_id,
        error: (row as { error: string }).error,
        finishedAt: (row as { finished_at: string }).finished_at,
      })),
  };
}
