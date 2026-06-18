import {
  formatDateKey,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
  startOfUtcDay,
} from "@/lib/admin/analytics/dateRange";
import type { AnalyticsBaseData, ProjectRecord, GenerationRunRecord } from "@/lib/admin/analytics/dataLoader";
import { getInternalFilterSummary, loadAnalyticsBase } from "@/lib/admin/analytics/dataLoader";

export const FUNNEL_STEP_DEFS = [
  { id: "registered", label: "注册" },
  { id: "firstProject", label: "首项目" },
  { id: "firstQueued", label: "首次排队" },
  { id: "firstRunning", label: "首次 Running" },
  { id: "firstReady", label: "首次 Ready" },
] as const;

export type FunnelStepId = (typeof FUNNEL_STEP_DEFS)[number]["id"];

export type UserMilestones = {
  userId: string;
  registeredAt: string;
  firstProjectAt: string | null;
  firstQueuedAt: string | null;
  firstRunningAt: string | null;
  firstReadyAt: string | null;
};

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(startOfUtcDay(date));
}

function minDateKey(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate < current ? candidate : current;
}

function firstModifyDate(project: ProjectRecord): string | null {
  if (!Array.isArray(project.modification_history)) return null;
  let earliest: string | null = null;
  for (const entry of project.modification_history) {
    if (!entry || typeof entry !== "object") continue;
    const modifiedAt = (entry as { modifiedAt?: unknown }).modifiedAt;
    if (typeof modifiedAt !== "string") continue;
    const key = dateKeyFromIso(modifiedAt);
    earliest = minDateKey(earliest, key);
  }
  return earliest;
}

export function buildUserMilestones(data: AnalyticsBaseData): UserMilestones[] {
  const byUser = new Map<string, UserMilestones>();

  for (const user of data.users) {
    const registeredAt = dateKeyFromIso(user.created_at);
    if (!registeredAt) continue;
    byUser.set(user.id, {
      userId: user.id,
      registeredAt,
      firstProjectAt: null,
      firstQueuedAt: null,
      firstRunningAt: null,
      firstReadyAt: null,
    });
  }

  for (const project of data.projects) {
    if (!project.user_id) continue;
    const row = byUser.get(project.user_id);
    if (!row) continue;
    row.firstProjectAt = minDateKey(row.firstProjectAt, dateKeyFromIso(project.created_at));
    if (project.status === "ready") {
      row.firstReadyAt = minDateKey(
        row.firstReadyAt,
        dateKeyFromIso(project.completed_at ?? project.created_at)
      );
    }
    const modifyKey = firstModifyDate(project);
    if (modifyKey && !row.firstReadyAt) {
      // modify tracked separately if needed later
    }
  }

  for (const run of data.runs) {
    if (!run.user_id) continue;
    const row = byUser.get(run.user_id);
    if (!row) continue;
    row.firstQueuedAt = minDateKey(row.firstQueuedAt, dateKeyFromIso(run.created_at));
    row.firstRunningAt = minDateKey(row.firstRunningAt, dateKeyFromIso(run.started_at));
    if (run.status === "succeeded") {
      row.firstReadyAt = minDateKey(
        row.firstReadyAt,
        dateKeyFromIso(run.finished_at ?? run.started_at ?? run.created_at)
      );
    }
  }

  return [...byUser.values()];
}

function stepValue(row: UserMilestones, stepId: FunnelStepId): string | null {
  switch (stepId) {
    case "registered":
      return row.registeredAt;
    case "firstProject":
      return row.firstProjectAt;
    case "firstQueued":
      return row.firstQueuedAt;
    case "firstRunning":
      return row.firstRunningAt;
    case "firstReady":
      return row.firstReadyAt;
    default:
      return null;
  }
}

function hasReachedStep(row: UserMilestones, stepId: FunnelStepId): boolean {
  if (stepId === "registered") return true;
  return stepValue(row, stepId) != null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function hoursBetween(fromKey: string, toKey: string): number | null {
  const start = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${toKey}T00:00:00.000Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 3_600_000;
}

export type ActivationFunnelResponse = {
  steps: Array<{
    id: FunnelStepId;
    label: string;
    count: number;
    conversionFromPrevious: number | null;
    conversionFromFirst: number;
  }>;
  conversionTrends: Array<{ date: string; values: Record<string, number> }>;
  stepTimings: Array<{
    fromStep: FunnelStepId;
    toStep: FunnelStepId;
    medianHours: number | null;
    sampleSize: number;
  }>;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
  internalFilter: ReturnType<typeof getInternalFilterSummary>;
};

export async function fetchActivationFunnel(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
}): Promise<ActivationFunnelResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const excludeInternal = params.excludeInternal !== false;

  const data = await loadAnalyticsBase({ from: range.from, to: range.to, excludeInternal });
  const milestones = buildUserMilestones(data);

  const cohort = milestones.filter(
    (row) => row.registeredAt >= keys[0] && row.registeredAt <= keys[keys.length - 1]
  );
  const cohortSize = cohort.length;

  const steps = FUNNEL_STEP_DEFS.map((def, index) => {
    const count = cohort.filter((row) => hasReachedStep(row, def.id)).length;
    const previousCount =
      index === 0 ? count : cohort.filter((row) => hasReachedStep(row, FUNNEL_STEP_DEFS[index - 1].id)).length;
    return {
      id: def.id,
      label: def.label,
      count,
      conversionFromPrevious:
        index === 0 || previousCount === 0
          ? null
          : Math.round((count / previousCount) * 1000) / 10,
      conversionFromFirst:
        cohortSize === 0 ? 0 : Math.round((count / cohortSize) * 1000) / 10,
    };
  });

  const trendSeries = Object.fromEntries(
    keys.map((date) => [
      date,
      {
        regToProject: 0,
        projectToReady: 0,
        regToReady: 0,
      },
    ])
  );

  for (const date of keys) {
    const registered = cohort.filter((row) => row.registeredAt === date);
    const regSize = registered.length;
    if (regSize === 0) continue;
    const toProject = registered.filter((row) => row.firstProjectAt).length;
    const toReady = registered.filter((row) => row.firstReadyAt).length;
    const withProject = registered.filter((row) => row.firstProjectAt);
    const projectToReady = withProject.filter((row) => row.firstReadyAt).length;
    trendSeries[date].regToProject = Math.round((toProject / regSize) * 1000) / 10;
    trendSeries[date].regToReady = Math.round((toReady / regSize) * 1000) / 10;
    trendSeries[date].projectToReady =
      withProject.length === 0
        ? 0
        : Math.round((projectToReady / withProject.length) * 1000) / 10;
  }

  const timingPairs: Array<[FunnelStepId, FunnelStepId]> = [
    ["registered", "firstProject"],
    ["firstProject", "firstQueued"],
    ["firstQueued", "firstRunning"],
    ["firstRunning", "firstReady"],
    ["registered", "firstReady"],
  ];

  const stepTimings = timingPairs.map(([fromStep, toStep]) => {
    const samples: number[] = [];
    for (const row of cohort) {
      const fromKey = stepValue(row, fromStep);
      const toKey = stepValue(row, toStep);
      if (!fromKey || !toKey) continue;
      const hours = hoursBetween(fromKey, toKey);
      if (hours != null) samples.push(hours);
    }
    return {
      fromStep,
      toStep,
      medianHours: median(samples),
      sampleSize: samples.length,
    };
  });

  return {
    steps,
    conversionTrends: seriesToPoints(trendSeries, keys),
    stepTimings,
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
    internalFilter: getInternalFilterSummary(data),
  };
}

export function funnelToCsv(data: ActivationFunnelResponse): string {
  const lines = [
    "step,count,conversion_from_previous,conversion_from_first",
    ...data.steps.map(
      (step) =>
        `${step.label},${step.count},${step.conversionFromPrevious ?? ""},${step.conversionFromFirst}`
    ),
    "",
    "date,reg_to_project_pct,project_to_ready_pct,reg_to_ready_pct",
    ...data.conversionTrends.map(
      (point) =>
        `${point.date},${point.values.regToProject},${point.values.projectToReady},${point.values.regToReady}`
    ),
  ];
  return lines.join("\n");
}
