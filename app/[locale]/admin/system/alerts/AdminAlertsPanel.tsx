"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAlert } from "@/lib/admin/analytics/alerts";
import { AlertList } from "../../components/AlertList";
import { MetricCard } from "../../components/MetricCard";

type AlertsResponse = {
  alerts: AdminAlert[];
  thresholds: {
    minSuccessRate: number;
    maxQueueDepth: number;
    maxAvgWaitSeconds: number;
  };
};

export function AdminAlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AlertsResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics/alerts");
      const json = (await res.json()) as { success?: boolean; data?: AlertsResponse; error?: string | null };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed to load alerts");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(timer);
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">系统告警</h1>
        <p className="mt-1 text-sm text-muted-foreground">基于环境变量阈值 · 每分钟自动刷新</p>
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard title="最低成功率" value={`${data.thresholds.minSuccessRate}%`} />
            <MetricCard title="队列上限" value={data.thresholds.maxQueueDepth} />
            <MetricCard title="等待上限" value={`${data.thresholds.maxAvgWaitSeconds}s`} />
          </div>
          <AlertList alerts={data.alerts} />
        </>
      ) : null}
    </div>
  );
}
