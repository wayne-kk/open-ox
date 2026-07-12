"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UserAnalyticsResponse } from "@/lib/admin/analytics/userAnalytics";
import { MetricCard } from "../../components/MetricCard";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";

export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserAnalyticsResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/analytics?days=90`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: UserAnalyticsResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed to load user");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-primary">
          ← 返回用户列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{data?.name ?? "用户详情"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.email ?? "—"} · {userId}
        </p>
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="项目数" value={data.projectCount} />
            <MetricCard title="Ready" value={data.readyCount} />
            <MetricCard title="Modify 次数" value={data.modifyCount} />
            <MetricCard
              title="注册时间"
              value={data.registeredAt ? new Date(data.registeredAt).toLocaleDateString() : "—"}
            />
          </div>

          <TimeSeriesChart
            title="Studio 停留（分钟/日）"
            data={data.dailyStudioMinutes}
            series={[{ key: "minutes", label: "分钟", color: "#f7931a" }]}
            valueSuffix=" min"
          />

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="mb-3 text-sm font-medium">行为时间线</h2>
            <div className="space-y-2">
              {data.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无事件</p>
              ) : (
                data.timeline.map((event, index) => (
                  <div key={`${event.at}-${index}`} className="flex gap-3 border-t border-white/5 pt-2 first:border-0 first:pt-0">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString()}
                    </span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase text-primary">
                      {event.kind}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p>{event.label}</p>
                      {event.meta ? <p className="truncate text-xs text-muted-foreground">{event.meta}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
