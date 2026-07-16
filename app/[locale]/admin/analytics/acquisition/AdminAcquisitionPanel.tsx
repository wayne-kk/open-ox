"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcquisitionResponse } from "@/lib/admin/analytics/acquisition";
import { AnalyticsToolbar } from "../../components/AnalyticsToolbar";
import { HorizontalBarChart } from "../../components/HorizontalBarChart";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { getDateRangeParams } from "../../components/DateRangeSelect";

const CHANNEL_LABELS: Record<string, string> = {
  utm: "UTM",
  referral: "外链",
  direct: "直接",
  unknown: "未知",
};

export function AdminAcquisitionPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AcquisitionResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(days);
      const params = new URLSearchParams({ from, to, excludeInternal: String(excludeInternal) });
      const res = await fetch(`/api/admin/analytics/acquisition?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: AcquisitionResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load acquisition");
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
          <h1 className="text-2xl font-semibold tracking-tight">获客与注册</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            First-touch：UTM / 外链 referrer / 落地页（按注册日 UTC 归桶）
          </p>
        </div>
        <AnalyticsToolbar
          days={days}
          onDaysChange={setDays}
          excludeInternal={excludeInternal}
          onExcludeInternalChange={setExcludeInternal}
        />
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">新增注册</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{data.totalRegistrations}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">已绑定首触</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{data.withAcquisition}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">覆盖率</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.totalRegistrations === 0
                  ? "—"
                  : `${Math.round((data.withAcquisition / data.totalRegistrations) * 100)}%`}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HorizontalBarChart
              title="渠道占比（注册）"
              items={data.channelShare.map((row) => ({
                label: CHANNEL_LABELS[row.channel] ?? row.channel,
                value: row.count,
              }))}
            />
            <TimeSeriesChart
              title="注册趋势 by 渠道"
              data={data.registrationTrend}
              series={[
                { key: "utm", label: "UTM", color: "#f7931a" },
                { key: "referral", label: "外链", color: "#60a5fa" },
                { key: "direct", label: "直接", color: "#34d399" },
                { key: "unknown", label: "未知", color: "#94a3b8" },
              ]}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HorizontalBarChart
              title="Top utm_source"
              items={data.bySource.map((row) => ({ label: row.key, value: row.count }))}
            />
            <HorizontalBarChart
              title="Top utm_medium"
              items={data.byMedium.map((row) => ({ label: row.key, value: row.count }))}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HorizontalBarChart
              title="Top utm_campaign"
              items={data.byCampaign.map((row) => ({ label: row.key, value: row.count }))}
            />
            <HorizontalBarChart
              title="Top referrer host"
              items={data.topReferrerHosts.map((row) => ({ label: row.key, value: row.count }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
