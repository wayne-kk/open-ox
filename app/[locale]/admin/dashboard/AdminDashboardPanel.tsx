"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminAlert } from "@/lib/admin/analytics/alerts";
import { AlertList } from "../components/AlertList";
import { MetricCard } from "../components/MetricCard";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { DateRangeSelect, getDateRangeParams } from "../components/DateRangeSelect";
import type { OverviewResponse } from "@/lib/admin/analytics/types";

function formatDelta(today: number, yesterday: number, suffix = ""): string {
  const diff = today - yesterday;
  const sign = diff > 0 ? "+" : "";
  return `较昨日 ${sign}${diff}${suffix}`;
}

function formatRate(value: number): string {
  return `${value}%`;
}

function formatMinutes(value: number): string {
  return `${value} min`;
}

export function AdminDashboardPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);

  const loadData = useCallback(async (rangeDays: number, exclude: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(rangeDays);
      const params = new URLSearchParams({ from, to, excludeInternal: String(exclude) });
      const res = await fetch(`/api/admin/analytics/overview?${params.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: OverviewResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load overview");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(days, excludeInternal);
    void fetch("/api/admin/analytics/alerts")
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: { alerts: AdminAlert[] } }) => {
        if (json.success && json.data) setAlerts(json.data.alerts.filter((a) => a.id !== "all-clear"));
      })
      .catch(() => undefined);
  }, [days, excludeInternal, loadData]);

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">数据总览</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            核心指标与趋势 · {data?.range.from} 至 {data?.range.to}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeSelect days={days} onChange={setDays} />
          <label className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => setExcludeInternal(e.target.checked)}
              className="accent-primary"
            />
            排除内部账号
          </label>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">系统告警</h2>
            <Link href="/admin/system/alerts" className="text-xs text-primary hover:underline">
              查看全部
            </Link>
          </div>
          <AlertList alerts={alerts.slice(0, 3)} compact />
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="新增注册"
            value={kpis.newRegistrations.today}
            delta={formatDelta(kpis.newRegistrations.today, kpis.newRegistrations.yesterday)}
            hint={`7 日均 ${kpis.newRegistrations.avg7d}`}
          />
          <MetricCard
            title="DAU"
            value={kpis.dau.today}
            delta={formatDelta(kpis.dau.today, kpis.dau.yesterday)}
            hint={`7 日均 ${kpis.dau.avg7d} · page_view / studio_heartbeat`}
          />
          <MetricCard
            title="新增项目"
            value={kpis.newProjects.today}
            delta={formatDelta(kpis.newProjects.today, kpis.newProjects.yesterday)}
            hint={`7 日均 ${kpis.newProjects.avg7d}`}
          />
          <MetricCard
            title="首次 Ready 用户"
            value={kpis.firstReadyUsers.today}
            delta={formatDelta(kpis.firstReadyUsers.today, kpis.firstReadyUsers.yesterday)}
            hint={`7 日均 ${kpis.firstReadyUsers.avg7d}`}
          />
          <MetricCard
            title="生成成功率"
            value={formatRate(kpis.generationSuccessRate.today)}
            delta={formatDelta(
              kpis.generationSuccessRate.today,
              kpis.generationSuccessRate.yesterday,
              "%"
            )}
            hint={`7 日均 ${formatRate(kpis.generationSuccessRate.avg7d)}`}
          />
          <MetricCard
            title="平均生成耗时"
            value={formatMinutes(kpis.avgGenerationMinutes.today)}
            delta={formatDelta(
              kpis.avgGenerationMinutes.today,
              kpis.avgGenerationMinutes.yesterday,
              " min"
            )}
            hint={`7 日均 ${formatMinutes(kpis.avgGenerationMinutes.avg7d)}`}
          />
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TimeSeriesChart
            title="用户增长"
            data={data.charts.userGrowth}
            series={[
              { key: "registrations", label: "新增注册", color: "#f7931a" },
              { key: "dau", label: "DAU", color: "#34d399" },
            ]}
          />
          <TimeSeriesChart
            title="项目生产"
            data={data.charts.projectProduction}
            series={[
              { key: "created", label: "新建", color: "#f7931a" },
              { key: "ready", label: "Ready", color: "#34d399" },
              { key: "failed", label: "Failed", color: "#f87171" },
            ]}
          />
          <TimeSeriesChart
            title="生成耗时（分钟）"
            data={data.charts.generationDuration}
            series={[
              { key: "avgMinutes", label: "平均", color: "#f7931a" },
              { key: "p50Minutes", label: "P50", color: "#60a5fa" },
            ]}
            valueSuffix=" min"
          />
          <TimeSeriesChart
            title="激活漏斗（每日事件数）"
            data={data.charts.activationFunnel}
            series={[
              { key: "registered", label: "注册", color: "#f7931a" },
              { key: "firstProject", label: "首项目", color: "#60a5fa" },
              { key: "firstReady", label: "首 Ready", color: "#34d399" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
