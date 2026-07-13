"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueueHealthResponse } from "@/lib/admin/analytics/types";
import { MetricCard } from "../../components/MetricCard";

export function AdminQueuePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QueueHealthResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics/queue");
      const json = (await res.json()) as {
        success?: boolean;
        data?: QueueHealthResponse;
        error?: string | null;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load queue health");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">生成队列</h1>
        <p className="mt-1 text-sm text-muted-foreground">Worker 队列健康 · 每 30 秒自动刷新</p>
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Queued" value={data.counts.queued} />
            <MetricCard title="Running" value={data.counts.running} />
            <MetricCard title="24h 成功" value={data.counts.succeeded24h} />
            <MetricCard title="24h 失败" value={data.counts.failed24h} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              平均排队等待：{" "}
              <span className="font-medium text-foreground">
                {data.avgWaitSeconds != null ? `${data.avgWaitSeconds}s` : "—"}
              </span>
              <span className="ml-2 text-xs">（近 30 条样本）</span>
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Run</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">等待</th>
                  <th className="px-3 py-2">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      暂无 Run
                    </td>
                  </tr>
                ) : (
                  data.recentRuns.map((run) => (
                    <tr key={run.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{run.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{run.projectId.slice(0, 12)}</td>
                      <td className="px-3 py-2">{run.status}</td>
                      <td className="px-3 py-2">{run.kind}</td>
                      <td className="px-3 py-2">
                        {run.waitSeconds != null ? `${run.waitSeconds}s` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.recentErrors.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">最近失败</h2>
              <div className="space-y-2">
                {data.recentErrors.map((item) => (
                  <div
                    key={item.runId}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.projectId} · {new Date(item.finishedAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-red-200">{item.error}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
