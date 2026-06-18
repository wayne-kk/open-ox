"use client";

import { useCallback, useEffect, useState } from "react";
import type { RetentionResponse } from "@/lib/admin/analytics/retention";
import { AnalyticsToolbar } from "../../components/AnalyticsToolbar";
import { CohortMatrix } from "../../components/CohortMatrix";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { getDateRangeParams } from "../../components/DateRangeSelect";

export function AdminRetentionPanel() {
  const [days, setDays] = useState(90);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [anchor, setAnchor] = useState<"registration" | "firstReady">("registration");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RetentionResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const params = new URLSearchParams({
        from,
        to,
        excludeInternal: String(excludeInternal),
        anchor,
      });
      const res = await fetch(`/api/admin/analytics/retention?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: RetentionResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load retention");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days, excludeInternal, anchor]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const curvePoints = (data?.curves ?? []).map((point) => ({
    date: point.date,
    values: point.values,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">留存分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cohort 矩阵 · {data?.range.from} 至 {data?.range.to}
          </p>
        </div>
        <AnalyticsToolbar
          days={days}
          onDaysChange={setDays}
          excludeInternal={excludeInternal}
          onExcludeInternalChange={setExcludeInternal}
          exportType="retention"
          anchor={anchor}
          onAnchorChange={setAnchor}
        />
      </div>

      {data?.excludeInternal ? (
        <p className="text-xs text-muted-foreground">
          已排除内部账号 · Cohort 锚点：
          {data.anchor === "firstReady" ? "首次 Ready 周" : "注册周"}
        </p>
      ) : null}

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <CohortMatrix cohorts={data.cohorts} />
          <TimeSeriesChart
            title="各 Cohort D7 留存对比（%）"
            data={curvePoints.map((point) => ({
              date: point.date,
              values: { d7: point.values.d7 },
            }))}
            series={[{ key: "d7", label: "D7", color: "#34d399" }]}
            valueSuffix="%"
          />
        </>
      ) : null}
    </div>
  );
}
