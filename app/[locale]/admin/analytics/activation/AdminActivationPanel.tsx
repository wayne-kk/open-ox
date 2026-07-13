"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivationFunnelResponse } from "@/lib/admin/analytics/funnel";
import { AnalyticsToolbar } from "../../components/AnalyticsToolbar";
import { FunnelChart } from "../../components/FunnelChart";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { getDateRangeParams } from "../../components/DateRangeSelect";

export function AdminActivationPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivationFunnelResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const params = new URLSearchParams({ from, to, excludeInternal: String(excludeInternal) });
      const res = await fetch(`/api/admin/analytics/funnel?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: ActivationFunnelResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load funnel");
      }
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
          <h1 className="text-2xl font-semibold tracking-tight">激活漏斗</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            注册 cohort 各步骤转化 · {data?.range.from} 至 {data?.range.to}
          </p>
        </div>
        <AnalyticsToolbar
          days={days}
          onDaysChange={setDays}
          excludeInternal={excludeInternal}
          onExcludeInternalChange={setExcludeInternal}
          exportType="funnel"
        />
      </div>

      {data?.excludeInternal ? (
        <p className="text-xs text-muted-foreground">
          已排除管理员（{data.internalFilter.excludedAdminCount}）、手动标记内部账号（
          {data.internalFilter.excludedManualCount}）
          {data.internalFilter.internalDomains.length > 0
            ? `、域名 ${data.internalFilter.internalDomains.join(", ")}`
            : ""}
        </p>
      ) : null}

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium">漏斗概览</h2>
            <FunnelChart steps={data.steps} />
          </div>

          <TimeSeriesChart
            title="转化率趋势（%，按注册日 cohort）"
            data={data.conversionTrends}
            series={[
              { key: "regToProject", label: "注册→首项目", color: "#f7931a" },
              { key: "projectToReady", label: "首项目→Ready", color: "#60a5fa" },
              { key: "regToReady", label: "注册→Ready", color: "#34d399" },
            ]}
            valueSuffix="%"
          />

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">步骤间隔</th>
                  <th className="px-3 py-2">中位耗时（小时）</th>
                  <th className="px-3 py-2">样本数</th>
                </tr>
              </thead>
              <tbody>
                {data.stepTimings.map((row) => (
                  <tr key={`${row.fromStep}-${row.toStep}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      {row.fromStep} → {row.toStep}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.medianHours != null ? row.medianHours.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.sampleSize}</td>
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
