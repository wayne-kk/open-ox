const DEFAULT_BASE_URL = "https://cloud.langfuse.com";

export type LangfuseDailyUsageRow = {
  model: string;
  inputUsage: number;
  outputUsage: number;
  totalUsage: number;
  totalCost: number;
};

export type LangfuseDailyMetric = {
  date: string;
  totalCost: number;
  countTraces: number;
  countObservations: number;
  usage: LangfuseDailyUsageRow[];
};

export function isLangfuseMetricsConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY?.trim() && process.env.LANGFUSE_PUBLIC_KEY?.trim()
  );
}

function resolveLangfuseBaseUrl(): string {
  return (
    process.env.LANGFUSE_BASE_URL?.trim() ||
    process.env.LANGFUSE_BASEURL?.trim() ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

function basicAuthHeader(): string {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
  const secret = process.env.LANGFUSE_SECRET_KEY?.trim() ?? "";
  return `Basic ${Buffer.from(`${publicKey}:${secret}`).toString("base64")}`;
}

function parseDailyMetricsPayload(payload: unknown): LangfuseDailyMetric[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    const item = row as Record<string, unknown>;
    const usageRaw = Array.isArray(item.usage) ? item.usage : [];
    return {
      date: String(item.date ?? ""),
      totalCost: Number(item.totalCost ?? 0),
      countTraces: Number(item.countTraces ?? 0),
      countObservations: Number(item.countObservations ?? 0),
      usage: usageRaw.map((entry) => {
        const u = entry as Record<string, unknown>;
        return {
          model: String(u.model ?? "unknown"),
          inputUsage: Number(u.inputUsage ?? 0),
          outputUsage: Number(u.outputUsage ?? 0),
          totalUsage: Number(u.totalUsage ?? 0),
          totalCost: Number(u.totalCost ?? 0),
        };
      }),
    };
  });
}

async function fetchLegacyDailyMetrics(from: Date, to: Date): Promise<LangfuseDailyMetric[]> {
  const baseUrl = resolveLangfuseBaseUrl();
  const url = new URL(`${baseUrl}/api/public/metrics/daily`);
  url.searchParams.set("fromTimestamp", from.toISOString());
  url.searchParams.set("toTimestamp", to.toISOString());

  const res = await fetch(url.toString(), {
    headers: { Authorization: basicAuthHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Langfuse daily metrics failed: ${res.status} ${await res.text()}`);
  }
  return parseDailyMetricsPayload(await res.json());
}

async function fetchMetricsV2Daily(from: Date, to: Date): Promise<LangfuseDailyMetric[]> {
  const baseUrl = resolveLangfuseBaseUrl();
  const query = {
    view: "observations",
    metrics: [
      { measure: "totalCost", aggregation: "sum" },
      { measure: "totalTokens", aggregation: "sum" },
      { measure: "count", aggregation: "count" },
    ],
    dimensions: [{ field: "providedModelName" }],
    filters: [],
    timeDimension: { granularity: "day" },
    fromTimestamp: from.toISOString(),
    toTimestamp: to.toISOString(),
    orderBy: [{ field: "time_dimension", direction: "asc" }],
    config: { row_limit: 1000 },
  };

  const url = new URL(`${baseUrl}/api/public/v2/metrics`);
  url.searchParams.set("query", JSON.stringify(query));

  const res = await fetch(url.toString(), {
    headers: { Authorization: basicAuthHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Langfuse v2 metrics failed: ${res.status}`);
  }

  const payload = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const rows = payload.data ?? [];
  const byDate = new Map<string, LangfuseDailyMetric>();

  for (const row of rows) {
    const date = String(row.time_dimension ?? row.timestampDay ?? row.date ?? "").slice(0, 10);
    if (!date) continue;
    const model = String(row.providedModelName ?? row.provided_model_name ?? "unknown");
    const totalCost = Number(row.sum_totalCost ?? row.totalCost ?? 0);
    const totalUsage = Number(row.sum_totalTokens ?? row.totalTokens ?? 0);
    const count = Number(row.count_count ?? row.count ?? 0);

    const existing = byDate.get(date) ?? {
      date,
      totalCost: 0,
      countTraces: 0,
      countObservations: count,
      usage: [],
    };
    existing.totalCost += totalCost;
    existing.countObservations += count;
    existing.usage.push({
      model,
      inputUsage: 0,
      outputUsage: 0,
      totalUsage,
      totalCost,
    });
    byDate.set(date, existing);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchLangfuseDailyMetrics(from: Date, to: Date): Promise<LangfuseDailyMetric[]> {
  if (!isLangfuseMetricsConfigured()) return [];

  try {
    return await fetchLegacyDailyMetrics(from, to);
  } catch (legacyErr) {
    try {
      return await fetchMetricsV2Daily(from, to);
    } catch {
      throw legacyErr;
    }
  }
}

export function aggregateModelCosts(metrics: LangfuseDailyMetric[]): Array<{
  model: string;
  totalCost: number;
  totalTokens: number;
}> {
  const totals = new Map<string, { totalCost: number; totalTokens: number }>();
  for (const day of metrics) {
    for (const row of day.usage) {
      const current = totals.get(row.model) ?? { totalCost: 0, totalTokens: 0 };
      current.totalCost += row.totalCost;
      current.totalTokens += row.totalUsage;
      totals.set(row.model, current);
    }
  }
  return [...totals.entries()]
    .map(([model, values]) => ({ model, ...values }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
