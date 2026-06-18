"use client";

import { useCallback, useEffect, useState } from "react";
import type { GenerationQualityResponse } from "@/lib/admin/analytics/generation";
import { AnalyticsToolbar } from "../../components/AnalyticsToolbar";
import { HorizontalBarChart } from "../../components/HorizontalBarChart";
import { MetricCard } from "../../components/MetricCard";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { getDateRangeParams } from "../../components/DateRangeSelect";

export function AdminGenerationPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerationQualityResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const params = new URLSearchParams({ from, to, excludeInternal: String(excludeInternal) });
      const res = await fetch(`/api/admin/analytics/generation?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: GenerationQualityResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed to load generation");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days, excludeInternal]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">生成质量</h1>
          <p className="mt-1 text-sm text-muted-foreground">成功率、失败原因、修复轮次与模型表现</p>
        </div>
        <AnalyticsToolbar
          days={days}
          onDaysChange={setDays}
          excludeInternal={excludeInternal}
          onExcludeInternalChange={setExcludeInternal}
          exportType="funnel"
        />
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <MetricCard title="生成成功率" value={`${data.successRate}%`} />

          <div className="grid gap-4 xl:grid-cols-2">
            <HorizontalBarChart
              title="失败原因 Top"
              items={data.failureReasons.map((row) => ({ label: row.reason, value: row.count }))}
            />
            <HorizontalBarChart
              title="Modify 次数分布（项目）"
              items={data.modifyDistribution.map((row) => ({ label: row.bucket, value: row.count }))}
            />
          </div>

          <TimeSeriesChart
            title="平均 Build 修复轮次"
            data={data.repairTrend}
            series={[{ key: "avgRepairRounds", label: "轮次", color: "#f7931a" }]}
          />

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Runs</th>
                  <th className="px-3 py-2">成功率</th>
                  <th className="px-3 py-2">平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map((row) => (
                  <tr key={row.modelId} className="border-t border-white/10">
                    <td className="px-3 py-2 font-mono text-xs">{row.modelId}</td>
                    <td className="px-3 py-2 tabular-nums">{row.runs}</td>
                    <td className="px-3 py-2 tabular-nums">{row.successRate}%</td>
                    <td className="px-3 py-2 tabular-nums">{row.avgMinutes} min</td>
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
