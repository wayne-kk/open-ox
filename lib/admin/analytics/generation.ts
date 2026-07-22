import {
  formatDateKey,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
} from "@/lib/admin/analytics/dateRange";
import {
  getInternalFilterSummary,
  loadAnalyticsAudience,
  type AnalyticsBaseData,
} from "@/lib/admin/analytics/dataLoader";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

interface ProjectWithMeta {
  id: string;
  user_id: string | null;
  status: string;
  model_id: string | null;
  build_steps: unknown;
  modification_history: unknown;
  created_at: string;
}

interface RunWithError {
  id: string;
  status: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  user_id: string | null;
  project_id: string;
}

function countRepairRounds(buildSteps: unknown): number {
  if (!Array.isArray(buildSteps)) return 0;
  return buildSteps.filter((step) => {
    if (typeof step === "string") return step.startsWith("repair_build");
    if (step && typeof step === "object") {
      const name =
        (step as { step?: unknown; name?: unknown }).step ??
        (step as { name?: unknown }).name;
      return typeof name === "string" && name.startsWith("repair_build");
    }
    return false;
  }).length;
}

function modifyCount(project: ProjectWithMeta): number {
  return Array.isArray(project.modification_history)
    ? project.modification_history.length
    : 0;
}

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    ),
  );
}

function rangeEndIso(to: Date): string {
  return new Date(to.getTime() + 86_399_999).toISOString();
}

function internalFilterSummary(
  audience: Awaited<ReturnType<typeof loadAnalyticsAudience>>,
) {
  const data = {
    ...audience,
    projects: [],
    runs: [],
    events: [],
  } satisfies AnalyticsBaseData;
  return getInternalFilterSummary(data);
}

export type GenerationQualityResponse = {
  successRate: number;
  failureReasons: Array<{ reason: string; count: number }>;
  repairTrend: Array<{ date: string; values: Record<string, number> }>;
  byModel: Array<{
    modelId: string;
    successRate: number;
    avgMinutes: number;
    runs: number;
  }>;
  modifyDistribution: Array<{ bucket: string; count: number }>;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
  internalFilter: ReturnType<typeof getInternalFilterSummary>;
};

export async function fetchGenerationQuality(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
}): Promise<GenerationQualityResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const excludeInternal = params.excludeInternal !== false;

  const service = createSupabaseServiceRoleClient();
  const rangeStart = range.from.toISOString();
  const rangeEnd = rangeEndIso(range.to);

  const [audience, projectsResult, runsResult, projectModelsResult] =
    await Promise.all([
      loadAnalyticsAudience({ excludeInternal }),
      service
        .from("projects")
        .select(
          "id, user_id, status, model_id, build_steps, modification_history, created_at",
        )
        .gte("created_at", rangeStart)
        .lte("created_at", rangeEnd),
      service
        .from("generation_runs")
        .select(
          "id, status, error, created_at, started_at, finished_at, user_id, project_id",
        )
        .gte("created_at", rangeStart)
        .lte("created_at", rangeEnd),
      service.from("projects").select("id, model_id"),
    ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (runsResult.error) throw new Error(runsResult.error.message);
  if (projectModelsResult.error)
    throw new Error(projectModelsResult.error.message);

  const allowed = new Set(audience.users.map((user) => user.id));
  const projects = ((projectsResult.data ?? []) as ProjectWithMeta[]).filter(
    (project) => !project.user_id || allowed.has(project.user_id),
  );
  const runs = ((runsResult.data ?? []) as RunWithError[]).filter(
    (run) => !run.user_id || allowed.has(run.user_id),
  );

  const projectsById = new Map(
    projects.map((project) => [project.id, project]),
  );
  for (const row of projectModelsResult.data ?? []) {
    const project = row as { id: string; model_id: string | null };
    if (!projectsById.has(project.id)) {
      projectsById.set(project.id, {
        id: project.id,
        user_id: null,
        status: "",
        model_id: project.model_id,
        build_steps: [],
        modification_history: [],
        created_at: "",
      });
    }
  }

  const terminalRuns = runs.filter(
    (run) => run.status === "succeeded" || run.status === "failed",
  );
  const succeeded = terminalRuns.filter(
    (run) => run.status === "succeeded",
  ).length;
  const successRate =
    terminalRuns.length === 0
      ? 0
      : Math.round((succeeded / terminalRuns.length) * 1000) / 10;

  const errorCounts = new Map<string, number>();
  for (const run of runs) {
    if (run.status !== "failed" || !run.error) continue;
    const reason = run.error.slice(0, 120);
    errorCounts.set(reason, (errorCounts.get(reason) ?? 0) + 1);
  }
  const failureReasons = [...errorCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const repairSeries = Object.fromEntries(
    keys.map((date) => [date, { avgRepairRounds: 0, samples: 0 }]),
  );
  for (const project of projects) {
    const key = dateKeyFromIso(project.created_at);
    if (!key || !repairSeries[key]) continue;
    const rounds = countRepairRounds(project.build_steps);
    repairSeries[key].avgRepairRounds += rounds;
    repairSeries[key].samples += 1;
  }
  for (const date of keys) {
    const row = repairSeries[date];
    row.avgRepairRounds =
      row.samples === 0
        ? 0
        : Math.round((row.avgRepairRounds / row.samples) * 10) / 10;
  }

  const modelStats = new Map<
    string,
    {
      runs: number;
      success: number;
      totalMinutes: number;
      durationSamples: number;
    }
  >();
  for (const run of terminalRuns) {
    const project = projectsById.get(run.project_id);
    const modelId = project?.model_id ?? "unknown";
    const stats = modelStats.get(modelId) ?? {
      runs: 0,
      success: 0,
      totalMinutes: 0,
      durationSamples: 0,
    };
    stats.runs += 1;
    if (run.status === "succeeded") stats.success += 1;
    if (run.started_at && run.finished_at) {
      const minutes =
        (new Date(run.finished_at).getTime() -
          new Date(run.started_at).getTime()) /
        60_000;
      if (minutes > 0) {
        stats.totalMinutes += minutes;
        stats.durationSamples += 1;
      }
    }
    modelStats.set(modelId, stats);
  }

  const byModel = [...modelStats.entries()]
    .map(([modelId, stats]) => ({
      modelId,
      runs: stats.runs,
      successRate:
        stats.runs === 0
          ? 0
          : Math.round((stats.success / stats.runs) * 1000) / 10,
      avgMinutes:
        stats.durationSamples === 0
          ? 0
          : Math.round((stats.totalMinutes / stats.durationSamples) * 10) / 10,
    }))
    .sort((a, b) => b.runs - a.runs);

  const modifyBuckets = new Map<string, number>([
    ["0", 0],
    ["1-2", 0],
    ["3-5", 0],
    ["6+", 0],
  ]);
  for (const project of projects) {
    const count = modifyCount(project);
    const bucket =
      count === 0 ? "0" : count <= 2 ? "1-2" : count <= 5 ? "3-5" : "6+";
    modifyBuckets.set(bucket, (modifyBuckets.get(bucket) ?? 0) + 1);
  }

  return {
    successRate,
    failureReasons,
    repairTrend: seriesToPoints(
      Object.fromEntries(
        keys.map((date) => [
          date,
          { avgRepairRounds: repairSeries[date].avgRepairRounds },
        ]),
      ),
      keys,
    ),
    byModel,
    modifyDistribution: [...modifyBuckets.entries()].map(([bucket, count]) => ({
      bucket,
      count,
    })),
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
    internalFilter: internalFilterSummary(audience),
  };
}
