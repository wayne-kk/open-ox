"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderPlus,
  Gauge,
  RefreshCw,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import type { AdminAlert } from "@/lib/admin/analytics/alerts";
import type {
  OverviewResponse,
  QueueHealthResponse,
} from "@/lib/admin/analytics/types";
import { AlertList } from "../components/AlertList";
import {
  DateRangeSelect,
  getDateRangeParams,
} from "../components/DateRangeSelect";
import { MetricCard } from "../components/MetricCard";
import { TimeSeriesChart } from "../components/TimeSeriesChart";

function formatDelta(today: number, yesterday: number, suffix = ""): string {
  const diff = Math.round((today - yesterday) * 10) / 10;
  return `较昨日 ${diff > 0 ? "+" : ""}${diff}${suffix}`;
}

function formatRate(value: number): string {
  return `${value}%`;
}

function formatMinutes(value: number): string {
  return `${value} min`;
}

async function readApiData<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const json = (await response.json()) as {
    success?: boolean;
    data?: T;
    error?: string | null;
  };
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error ?? fallback);
  }
  return json.data;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="正在加载总览">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-[116px] animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
      <div className="h-24 animate-pulse border-y border-border bg-muted/40" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
        <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function AdminDashboardPanel() {
  const [days, setDays] = useState(30);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [queue, setQueue] = useState<QueueHealthResponse | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadData = useCallback(async (rangeDays: number, exclude: boolean) => {
    setLoading(true);
    setError(null);
    const { from, to } = getDateRangeParams(rangeDays);
    const params = new URLSearchParams({
      from,
      to,
      excludeInternal: String(exclude),
    });

    try {
      const [overviewResult, queueResult, alertsResult] =
        await Promise.allSettled([
          fetch(`/api/admin/analytics/overview?${params.toString()}`).then(
            (response) =>
              readApiData<OverviewResponse>(response, "无法加载总览"),
          ),
          fetch("/api/admin/analytics/queue").then((response) =>
            readApiData<QueueHealthResponse>(response, "无法加载队列状态"),
          ),
          fetch("/api/admin/analytics/alerts").then((response) =>
            readApiData<{ alerts: AdminAlert[] }>(response, "无法加载告警"),
          ),
        ]);

      if (overviewResult.status === "rejected") throw overviewResult.reason;
      setData(overviewResult.value);
      if (queueResult.status === "fulfilled") setQueue(queueResult.value);
      if (alertsResult.status === "fulfilled") {
        setAlerts(
          alertsResult.value.alerts.filter((alert) => alert.id !== "all-clear"),
        );
      }
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(days, excludeInternal);
  }, [days, excludeInternal, loadData]);

  const queueDepth = (queue?.counts.queued ?? 0) + (queue?.counts.running ?? 0);
  const kpis = data?.kpis;
  const periodTotals = useMemo(() => {
    if (!data) return null;
    return data.charts.projectProduction.reduce(
      (totals, point) => ({
        created: totals.created + (point.values.created ?? 0),
        ready: totals.ready + (point.values.ready ?? 0),
        failed: totals.failed + (point.values.failed ?? 0),
      }),
      { created: 0, ready: 0, failed: 0 },
    );
  }, [data]);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">运营总览</h1>
            {queue ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    queue.counts.failed24h > 0
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
                {queue.counts.failed24h > 0 ? "有异常待处理" : "系统正常"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? `${data.range.from} 至 ${data.range.to}`
              : "核心业务与系统健康"}
            {updatedAt
              ? ` · ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 更新`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelect days={days} onChange={setDays} />
          <label className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(event) => setExcludeInternal(event.target.checked)}
              className="accent-primary"
            />
            排除内部账号
          </label>
          <button
            type="button"
            onClick={() => void loadData(days, excludeInternal)}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="刷新数据"
            aria-label="刷新数据"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-center justify-between gap-4 border-l-2 border-rose-500 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            className="font-medium"
            onClick={() => void loadData(days, excludeInternal)}
          >
            重试
          </button>
        </div>
      ) : null}

      {loading && !data ? <DashboardSkeleton /> : null}

      {kpis ? (
        <section
          aria-label="今日核心指标"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <MetricCard
            title="新增注册"
            value={kpis.newRegistrations.today}
            delta={formatDelta(
              kpis.newRegistrations.today,
              kpis.newRegistrations.yesterday,
            )}
            deltaValue={
              kpis.newRegistrations.today - kpis.newRegistrations.yesterday
            }
            hint={`· 7 日均 ${kpis.newRegistrations.avg7d}`}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <MetricCard
            title="日活用户"
            value={kpis.dau.today}
            delta={formatDelta(kpis.dau.today, kpis.dau.yesterday)}
            deltaValue={kpis.dau.today - kpis.dau.yesterday}
            hint={`· 7 日均 ${kpis.dau.avg7d}`}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="新增项目"
            value={kpis.newProjects.today}
            delta={formatDelta(
              kpis.newProjects.today,
              kpis.newProjects.yesterday,
            )}
            deltaValue={kpis.newProjects.today - kpis.newProjects.yesterday}
            hint={`· 7 日均 ${kpis.newProjects.avg7d}`}
            icon={<FolderPlus className="h-4 w-4" />}
          />
          <MetricCard
            title="首次 Ready 用户"
            value={kpis.firstReadyUsers.today}
            delta={formatDelta(
              kpis.firstReadyUsers.today,
              kpis.firstReadyUsers.yesterday,
            )}
            deltaValue={
              kpis.firstReadyUsers.today - kpis.firstReadyUsers.yesterday
            }
            hint={`· 7 日均 ${kpis.firstReadyUsers.avg7d}`}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <MetricCard
            title="生成成功率"
            value={formatRate(kpis.generationSuccessRate.today)}
            delta={formatDelta(
              kpis.generationSuccessRate.today,
              kpis.generationSuccessRate.yesterday,
              "%",
            )}
            deltaValue={
              kpis.generationSuccessRate.today -
              kpis.generationSuccessRate.yesterday
            }
            hint={`· 7 日均 ${formatRate(kpis.generationSuccessRate.avg7d)}`}
            icon={<Gauge className="h-4 w-4" />}
          />
          <MetricCard
            title="平均生成耗时"
            value={formatMinutes(kpis.avgGenerationMinutes.today)}
            delta={formatDelta(
              kpis.avgGenerationMinutes.today,
              kpis.avgGenerationMinutes.yesterday,
              " min",
            )}
            deltaValue={
              kpis.avgGenerationMinutes.today -
              kpis.avgGenerationMinutes.yesterday
            }
            lowerIsBetter
            hint={`· 7 日均 ${formatMinutes(kpis.avgGenerationMinutes.avg7d)}`}
            icon={<Clock3 className="h-4 w-4" />}
          />
        </section>
      ) : null}

      {queue ? (
        <section
          className="border-y border-border py-4"
          aria-labelledby="system-health-title"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="system-health-title" className="text-sm font-semibold">
                系统运行
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                队列实时状态与最近 24 小时结果
              </p>
            </div>
            <Link
              href="/admin/system/queue"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              查看队列 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <p className="text-xs text-muted-foreground">当前任务</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {queueDepth}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">等待中</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {queue.counts.queued}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">运行中</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {queue.counts.running}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">24h 成功</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {queue.counts.succeeded24h}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">24h 失败</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {queue.counts.failed24h}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">平均等待</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {queue.avgWaitSeconds == null
                  ? "—"
                  : `${queue.avgWaitSeconds}s`}
              </p>
            </div>
          </div>
          {queue.recentErrors[0] ? (
            <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <p className="min-w-0 truncate text-muted-foreground">
                最近失败：
                <span className="text-foreground">
                  {queue.recentErrors[0].error}
                </span>
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {alerts.length > 0 ? (
        <section className="grid gap-4 border-l-2 border-amber-500 bg-amber-500/5 px-4 py-4 lg:grid-cols-[180px_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold">需要关注</h2>
            </div>
            <Link
              href="/admin/system/alerts"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              查看全部 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <AlertList alerts={alerts.slice(0, 3)} compact />
        </section>
      ) : null}

      {data ? (
        <section className="space-y-4" aria-labelledby="trend-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="trend-title" className="text-base font-semibold">
                趋势与转化
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                所选周期内的用户增长、项目交付和生成效率
              </p>
            </div>
            {periodTotals ? (
              <p className="text-xs tabular-nums text-muted-foreground">
                周期项目 {periodTotals.created} · Ready {periodTotals.ready} ·
                Failed {periodTotals.failed}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TimeSeriesChart
              title="用户增长"
              description="注册用户与有效活跃用户（日）"
              data={data.charts.userGrowth}
              series={[
                { key: "registrations", label: "新增注册", color: "#7c6bc4" },
                { key: "dau", label: "DAU", color: "#059669" },
              ]}
            />
            <TimeSeriesChart
              title="项目生产"
              description="新建、完成与失败项目（日）"
              data={data.charts.projectProduction}
              series={[
                { key: "created", label: "新建", color: "#7c6bc4" },
                { key: "ready", label: "Ready", color: "#059669" },
                { key: "failed", label: "Failed", color: "#e11d48" },
              ]}
            />
            <TimeSeriesChart
              title="生成耗时"
              description="平均值与 P50，识别性能变化"
              data={data.charts.generationDuration}
              series={[
                { key: "avgMinutes", label: "平均", color: "#7c6bc4" },
                { key: "p50Minutes", label: "P50", color: "#2563eb" },
              ]}
              valueSuffix=" min"
            />
            <TimeSeriesChart
              title="激活进展"
              description="注册到首项目、首个 Ready 的每日里程碑"
              data={data.charts.activationFunnel}
              series={[
                { key: "registered", label: "注册", color: "#7c6bc4" },
                { key: "firstProject", label: "首项目", color: "#2563eb" },
                { key: "firstReady", label: "首 Ready", color: "#059669" },
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
