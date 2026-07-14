"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UserAnalyticsResponse } from "@/lib/admin/analytics/userAnalytics";
import type { UserActivityStatus } from "@/lib/admin/userDirectory";
import { MetricCard } from "../../components/MetricCard";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";

const STATUS_LABEL: Record<UserActivityStatus, string> = {
  active: "活跃",
  silent: "沉默",
  churned: "流失",
  never: "从未活跃",
};

const QUICK_AMOUNTS = [12, 50, 100, 200] as const;

export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserAnalyticsResponse | null>(null);

  const [grantAmount, setGrantAmount] = useState("50");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMessage, setGrantMessage] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

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
      setLiveBalance(json.data.creditBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitGrant = useCallback(async () => {
    setGranting(true);
    setGrantError(null);
    setGrantMessage(null);
    try {
      const amount = Number(grantAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("请输入大于 0 的充值数量");
      }
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: grantReason.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string | null;
        data?: { granted: number; balance: number; reason: string };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "充值失败");
      }
      setLiveBalance(json.data.balance);
      setGrantMessage(
        `已充值 ${json.data.granted} 积分，当前余额 ${json.data.balance}`
      );
      setGrantReason("");
      setData((prev) =>
        prev
          ? {
              ...prev,
              creditBalance: json.data!.balance,
            }
          : prev
      );
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : String(err));
    } finally {
      setGranting(false);
    }
  }, [grantAmount, grantReason, userId]);

  const displayBalance = liveBalance ?? data?.creditBalance ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-primary">
          ← 返回用户列表
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data?.name ?? "用户详情"}</h1>
          {data?.isAdmin ? (
            <span className="rounded border border-primary/35 bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
              Admin
            </span>
          ) : null}
          {data ? (
            <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {STATUS_LABEL[data.activityStatus]}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.email ?? "—"} · {data?.provider ?? "—"} · {userId}
        </p>
        {data?.lastActiveAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            最后活跃 {new Date(data.lastActiveAt).toLocaleString()}
          </p>
        ) : null}
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
              title="Credits"
              value={
                displayBalance == null
                  ? "—"
                  : `${displayBalance} (${data.creditPlan ?? "free"})`
              }
            />
            <MetricCard
              title="注册时间"
              value={data.registeredAt ? new Date(data.registeredAt).toLocaleDateString() : "—"}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">手动充值积分</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  向该用户账户增加积分（ledger: grant_adjust）。单次上限 10000。
                </p>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                当前余额{" "}
                <span className="font-semibold text-foreground">
                  {displayBalance == null ? "—" : displayBalance}
                </span>
              </p>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGrantAmount(String(n))}
                  className={`rounded-md border px-2.5 py-1 text-xs tabular-nums transition ${
                    grantAmount === String(n)
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  +{n}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
              <label className="block text-xs text-muted-foreground">
                数量
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  max={10000}
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:border-primary/50"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                备注（可选）
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="例如：客服补偿 / 内测额度"
                  maxLength={240}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/50"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={granting}
                  onClick={() => void submitGrant()}
                  className="h-[38px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {granting ? "充值中…" : "确认充值"}
                </button>
              </div>
            </div>

            {grantMessage ? (
              <p className="mt-3 text-sm text-emerald-400">{grantMessage}</p>
            ) : null}
            {grantError ? <p className="mt-3 text-sm text-red-300">{grantError}</p> : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">项目（最多 30）</h2>
            {data.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无项目</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">名称</th>
                      <th className="pb-2 pr-3">状态</th>
                      <th className="pb-2 pr-3">创建</th>
                      <th className="pb-2">Studio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((project) => (
                      <tr key={project.id} className="border-t border-border">
                        <td className="py-2 pr-3">{project.name}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{project.status}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <Link
                            href={`/studio/${project.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            打开
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <TimeSeriesChart
            title="Studio 停留（分钟/日）"
            data={data.dailyStudioMinutes}
            series={[{ key: "minutes", label: "分钟", color: "#f7931a" }]}
            valueSuffix=" min"
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">行为时间线</h2>
            <div className="space-y-2">
              {data.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无事件</p>
              ) : (
                data.timeline.map((event, index) => (
                  <div
                    key={`${event.at}-${index}`}
                    className="flex gap-3 border-t border-border pt-2 first:border-0 first:pt-0"
                  >
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString()}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase text-primary">
                      {event.kind}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p>{event.label}</p>
                      {event.meta ? (
                        <p className="truncate text-xs text-muted-foreground">{event.meta}</p>
                      ) : null}
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
