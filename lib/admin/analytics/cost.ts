import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  formatDateKey,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
} from "@/lib/admin/analytics/dateRange";
import {
  aggregateModelCosts,
  fetchLangfuseDailyMetrics,
  isLangfuseMetricsConfigured,
} from "@/lib/observability/langfuseMetrics";

export type CostAnalyticsResponse = {
  configured: boolean;
  langfuseHost: string | null;
  totalCost: number;
  avgDailyCost: number;
  totalTokens: number;
  readyProjects: number;
  costPerReadyProject: number | null;
  dailyCost: Array<{ date: string; values: Record<string, number> }>;
  byModel: Array<{ model: string; totalCost: number; totalTokens: number; sharePct: number }>;
  range: { from: string; to: string; days: number };
};

export async function fetchCostAnalytics(params: {
  from?: string | null;
  to?: string | null;
}): Promise<CostAnalyticsResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const configured = isLangfuseMetricsConfigured();

  if (!configured) {
    return {
      configured: false,
      langfuseHost: null,
      totalCost: 0,
      avgDailyCost: 0,
      totalTokens: 0,
      readyProjects: 0,
      costPerReadyProject: null,
      dailyCost: seriesToPoints(
        Object.fromEntries(keys.map((date) => [date, { costUsd: 0 }])),
        keys
      ),
      byModel: [],
      range: {
        from: keys[0] ?? formatDateKey(range.from),
        to: keys[keys.length - 1] ?? formatDateKey(range.to),
        days: range.days,
      },
    };
  }

  const metrics = await fetchLangfuseDailyMetrics(range.from, range.to);
  const costByDate = Object.fromEntries(keys.map((date) => [date, { costUsd: 0 }]));
  for (const day of metrics) {
    if (costByDate[day.date]) {
      costByDate[day.date].costUsd = Math.round(day.totalCost * 100) / 100;
    }
  }

  const totalCost = Math.round(metrics.reduce((sum, day) => sum + day.totalCost, 0) * 100) / 100;
  const totalTokens = metrics.reduce(
    (sum, day) => sum + day.usage.reduce((inner, row) => inner + row.totalUsage, 0),
    0
  );

  const service = createSupabaseServiceRoleClient();
  const { count: readyProjects } = await service
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .gte("completed_at", range.from.toISOString())
    .lte("completed_at", new Date(range.to.getTime() + 86_399_999).toISOString());

  const readyCount = readyProjects ?? 0;
  const modelTotals = aggregateModelCosts(metrics);

  return {
    configured: true,
    langfuseHost:
      process.env.LANGFUSE_BASE_URL?.trim() ||
      process.env.LANGFUSE_BASEURL?.trim() ||
      "https://cloud.langfuse.com",
    totalCost,
    avgDailyCost: keys.length === 0 ? 0 : Math.round((totalCost / keys.length) * 100) / 100,
    totalTokens,
    readyProjects: readyCount,
    costPerReadyProject:
      readyCount > 0 ? Math.round((totalCost / readyCount) * 100) / 100 : null,
    dailyCost: seriesToPoints(costByDate, keys),
    byModel: modelTotals.map((row) => ({
      ...row,
      totalCost: Math.round(row.totalCost * 100) / 100,
      sharePct: totalCost === 0 ? 0 : Math.round((row.totalCost / totalCost) * 1000) / 10,
    })),
    range: {
      from: keys[0] ?? formatDateKey(range.from),
      to: keys[keys.length - 1] ?? formatDateKey(range.to),
      days: range.days,
    },
  };
}
