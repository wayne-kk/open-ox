"use client";

import { useCallback, useEffect, useState } from "react";
import type { CostAnalyticsResponse } from "@/lib/admin/analytics/cost";
import { DateRangeSelect, getDateRangeParams } from "../../components/DateRangeSelect";
import { MetricCard } from "../../components/MetricCard";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { HorizontalBarChart } from "../../components/HorizontalBarChart";

export function AdminCostPanel() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CostAnalyticsResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const res = await fetch(`/api/admin/analytics/cost?from=${from}&to=${to}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: CostAnalyticsResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load cost analytics");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">成本分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Langfuse Token 成本 · 内部可见
          </p>
        </div>
        <DateRangeSelect days={days} onChange={setDays} />
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data && !data.configured ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
          未配置 Langfuse（需要 `LANGFUSE_PUBLIC_KEY` 和 `LANGFUSE_SECRET_KEY`）。可在{" "}
          <a
            href="https://cloud.langfuse.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Langfuse Cloud
          </a>{" "}
          查看原始数据。
        </div>
      ) : null}

      {data?.configured ? (
        <>
          <p className="text-xs text-muted-foreground">数据源：{data.langfuseHost}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="区间总成本" value={`$${data.totalCost}`} />
            <MetricCard title="日均成本" value={`$${data.avgDailyCost}`} />
            <MetricCard
              title="每 Ready 站点成本"
              value={data.costPerReadyProject != null ? `$${data.costPerReadyProject}` : "—"}
              hint={`${data.readyProjects} 个 Ready 项目`}
            />
            <MetricCard title="总 Token" value={data.totalTokens.toLocaleString()} />
          </div>

          <TimeSeriesChart
            title="日成本（USD）"
            data={data.dailyCost}
            series={[{ key: "costUsd", label: "成本", color: "#f7931a" }]}
            valueSuffix=" USD"
          />

          <HorizontalBarChart
            title="模型成本结构"
            items={data.byModel.map((row) => ({
              label: `${row.model} (${row.sharePct}%)`,
              value: row.totalCost,
              suffix: " USD",
            }))}
          />

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Cost (USD)</th>
                  <th className="px-3 py-2">Tokens</th>
                  <th className="px-3 py-2">占比</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map((row) => (
                  <tr key={row.model} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                    <td className="px-3 py-2 tabular-nums">${row.totalCost}</td>
                    <td className="px-3 py-2 tabular-nums">{row.totalTokens.toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">{row.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
