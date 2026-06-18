"use client";

import { useCallback, useEffect, useState } from "react";
import type { EngagementResponse } from "@/lib/admin/analytics/engagement";
import { AnalyticsToolbar } from "../../components/AnalyticsToolbar";
import { ActivityHeatmap } from "../../components/ActivityHeatmap";
import { HorizontalBarChart } from "../../components/HorizontalBarChart";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { getDateRangeParams } from "../../components/DateRangeSelect";

export function AdminEngagementPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EngagementResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const params = new URLSearchParams({ from, to, excludeInternal: String(excludeInternal) });
      const res = await fetch(`/api/admin/analytics/engagement?${params.toString()}`);
      const json = (await res.json()) as { success?: boolean; data?: EngagementResponse; error?: string | null };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed to load engagement");
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
          <h1 className="text-2xl font-semibold tracking-tight">停留与活跃</h1>
          <p className="mt-1 text-sm text-muted-foreground">Session 时长、页面停留与活跃热力图</p>
        </div>
        <AnalyticsToolbar
          days={days}
          onDaysChange={setDays}
          excludeInternal={excludeInternal}
          onExcludeInternalChange={setExcludeInternal}
          exportType="engagement"
        />
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <HorizontalBarChart
            title="Session 时长分布"
            items={data.durationDistribution.map((row) => ({
              label: `${row.bucket} min`,
              value: row.count,
            }))}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <HorizontalBarChart
              title="页面平均停留 Top"
              items={data.pageDwell.map((row) => ({
                label: row.path,
                value: row.avgMinutes,
                suffix: " min",
              }))}
            />
            <TimeSeriesChart
              title="Session 时长趋势"
              data={data.sessionTrend}
              series={[
                { key: "avgMinutes", label: "平均", color: "#f7931a" },
                { key: "p50Minutes", label: "P50", color: "#60a5fa" },
                { key: "p90Minutes", label: "P90", color: "#34d399" },
              ]}
              valueSuffix=" min"
            />
          </div>

          <TimeSeriesChart
            title="深度会话占比（>10min 且有 Modify）"
            data={data.deepSessionTrend}
            series={[{ key: "deepRatio", label: "占比", color: "#f7931a" }]}
            valueSuffix="%"
          />

          <HorizontalBarChart
            title="功能模块停留（分钟）"
            items={data.moduleDwell.map((row) => ({
              label: row.module,
              value: row.totalMinutes,
              suffix: " min",
            }))}
          />

          <ActivityHeatmap title="活跃热力图（UTC）" cells={data.heatmap} />
        </>
      ) : null}
    </div>
  );
}
