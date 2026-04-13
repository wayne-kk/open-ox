"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RunListItem = {
  run_id: string;
  task_id: string;
  status: "running" | "finished";
  schema_version: string;
  created_at: string;
  evaluator?: {
    verdict: "passed" | "failed" | "partial";
    summary: string;
    failure_type?: string | null;
  } | null;
};

type TrajectoryEvent = {
  seq: number;
  ts: string;
  phase: string;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
};

type RunDetailResponse = {
  run: RunListItem;
  evaluator: RunListItem["evaluator"];
  events: TrajectoryEvent[];
  count: number;
};

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function colorForVerdict(verdict?: string | null) {
  if (verdict === "passed") return "#16a34a";
  if (verdict === "partial") return "#d97706";
  if (verdict === "failed") return "#dc2626";
  return "#64748b";
}

function colorForEventType(type: string) {
  if (type === "run_start") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (type === "run_end") return "text-cyan-300 border-cyan-500/40 bg-cyan-500/10";
  if (type === "error") return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  if (type === "shell_command") return "text-indigo-300 border-indigo-500/40 bg-indigo-500/10";
  if (type === "shell_result") return "text-violet-300 border-violet-500/40 bg-violet-500/10";
  if (type === "checkpoint") return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  return "text-slate-300 border-slate-500/40 bg-slate-500/10";
}

export default function TrajectoriesPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [manifestResult, setManifestResult] = useState<Record<string, unknown> | null>(null);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    setError(null);
    try {
      const res = await fetch("/api/trajectories?limit=30");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRuns(data.runs ?? []);
      if (!selectedRunId && data.runs?.[0]?.run_id) setSelectedRunId(data.runs[0].run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载轨迹列表失败");
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedRunId]);

  const loadDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/trajectories/${runId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDetail(data as RunDetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载运行详情失败");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (selectedRunId) void loadDetail(selectedRunId);
  }, [selectedRunId, loadDetail]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.run_id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const stats = useMemo(() => {
    const total = runs.length;
    const finished = runs.filter((r) => r.status === "finished").length;
    const failed = runs.filter((r) => r.evaluator?.verdict === "failed").length;
    const partial = runs.filter((r) => r.evaluator?.verdict === "partial").length;
    const withFailureType = runs.filter((r) => Boolean(r.evaluator?.failure_type)).length;
    return { total, finished, failed, partial, withFailureType };
  }, [runs]);

  const failureModes = useMemo(() => {
    const map = new Map<string, number>();
    for (const run of runs) {
      if (run.evaluator?.verdict !== "failed") continue;
      const key = (run.evaluator?.failure_type || "unknown_failure").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [runs]);

  const triggerEvaluate = useCallback(async () => {
    if (!selectedRunId) return;
    setError(null);
    try {
      const res = await fetch(`/api/trajectories/${selectedRunId}/evaluate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await Promise.all([loadRuns(), loadDetail(selectedRunId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "评估运行失败");
    }
  }, [selectedRunId, loadRuns, loadDetail]);

  const buildExportQuery = useCallback(
    (opts?: { manifestOnly?: boolean; selectedOnly?: boolean }) => {
      const params = new URLSearchParams();
      if (opts?.selectedOnly && selectedRunId) params.set("runId", selectedRunId);
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());
      if (opts?.manifestOnly) params.set("format", "manifest-only");
      else params.set("download", "1");
      return `/api/trajectories/export?${params.toString()}`;
    },
    [selectedRunId, from, to]
  );

  const loadManifestOnly = useCallback(async () => {
    setError(null);
    setManifestResult(null);
    try {
      const res = await fetch(buildExportQuery({ manifestOnly: true }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setManifestResult(data.manifest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载清单失败");
    }
  }, [buildExportQuery]);

  const repairEpisodes = useMemo(() => {
    if (!detail) return [];
    const episodes = new Map<string, Record<string, unknown>>();
    for (const evt of detail.events) {
      const payload = evt.payload as Record<string, unknown>;
      const episodeId = typeof payload.episode_id === "string" ? payload.episode_id : null;
      if (!episodeId) continue;
      const current = episodes.get(episodeId) ?? { episode_id: episodeId };
      if (evt.event_type === "repair_episode_started") {
        current.trigger_step = payload.trigger_step ?? null;
        current.error_summary = payload.error_summary ?? null;
      }
      if (evt.event_type === "repair_action_result") {
        current.action_status = payload.status ?? null;
        current.action_detail = payload.detail ?? null;
      }
      if (evt.event_type === "repair_verification_result") {
        current.verify_status = payload.status ?? null;
        current.verify_detail = payload.detail ?? null;
      }
      if (evt.event_type === "repair_episode_finished") {
        current.outcome = payload.outcome ?? null;
      }
      episodes.set(episodeId, current);
    }
    return Array.from(episodes.values());
  }, [detail]);

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">轨迹数据控制台</h1>
            <p className="mt-1 text-sm text-slate-400">聚焦“出错 -&gt; 修复 -&gt; 验证”的高价值训练数据。</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:border-slate-500" onClick={() => void loadRuns()}>
              {loadingRuns ? "刷新中..." : "刷新"}
            </button>
            <button className="rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-3 py-2 text-sm text-indigo-100 disabled:opacity-40" onClick={() => void triggerEvaluate()} disabled={!selectedRunId}>
              评估当前运行
            </button>
            <a className={`rounded-lg border px-3 py-2 text-sm ${selectedRunId ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100" : "pointer-events-none border-slate-700 bg-slate-900/60 text-slate-500"}`} href={selectedRunId ? buildExportQuery({ selectedOnly: true }) : "#"}>
              导出 JSONL
            </a>
            <button className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" onClick={() => void loadManifestOnly()}>
              仅看清单
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"><div className="text-slate-500">运行数</div><div className="mt-1 text-lg font-semibold">{stats.total}</div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"><div className="text-slate-500">已结束</div><div className="mt-1 text-lg font-semibold">{stats.finished}</div></div>
          <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-3 py-2 text-xs"><div className="text-amber-300">部分通过</div><div className="mt-1 text-lg font-semibold text-amber-200">{stats.partial}</div></div>
          <div className="rounded-lg border border-rose-700/40 bg-rose-900/10 px-3 py-2 text-xs"><div className="text-rose-300">失败</div><div className="mt-1 text-lg font-semibold text-rose-200">{stats.failed}</div></div>
          <div className="rounded-lg border border-fuchsia-700/40 bg-fuchsia-900/10 px-3 py-2 text-xs"><div className="text-fuchsia-300">可归因失败</div><div className="mt-1 text-lg font-semibold text-fuchsia-200">{stats.withFailureType}</div></div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 text-sm font-medium text-slate-200">失败模式排行（核心）</div>
          {failureModes.length === 0 ? (
            <div className="text-xs text-slate-500">当前筛选范围内没有失败运行。</div>
          ) : (
            <div className="space-y-2">
              {failureModes.map(([mode, count]) => (
                <div key={mode} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                  <span className="text-slate-300">{mode}</span>
                  <span className="font-semibold text-rose-300">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 text-sm font-medium text-slate-200">导出筛选</div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-slate-400">开始时间（ISO）
              <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-04-01T00:00:00.000Z" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500" />
            </label>
            <label className="text-xs text-slate-400">结束时间（ISO）
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-04-30T23:59:59.999Z" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500" />
            </label>
            <div className="flex items-end gap-2">
              <a className="rounded-lg border border-teal-500/60 bg-teal-500/20 px-3 py-2 text-xs text-teal-100" href={buildExportQuery()}>按筛选导出</a>
              <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200" onClick={() => { setFrom(""); setTo(""); setManifestResult(null); }}>清空</button>
            </div>
          </div>
          {manifestResult ? <pre className="mt-3 overflow-auto rounded-lg border border-slate-800 bg-[#0a1020] p-2 text-[11px] text-slate-300">{JSON.stringify(manifestResult, null, 2)}</pre> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[360px_1fr]">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">最近运行</div>
            <div className="max-h-[72vh] overflow-auto">
              {runs.length === 0 ? (
                <div className="px-3 py-5 text-sm text-slate-400">{loadingRuns ? "加载中..." : "暂无轨迹运行数据。"}</div>
              ) : (
                runs.map((run) => (
                  <button key={run.run_id} onClick={() => setSelectedRunId(run.run_id)} className={`w-full border-b border-slate-900 px-4 py-3 text-left text-sm ${selectedRunId === run.run_id ? "bg-indigo-500/10" : "hover:bg-slate-900/60"}`}>
                    <div className="font-mono text-xs text-slate-300">{run.run_id}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{run.task_id}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-200">{run.status}</span>
                      <span className="font-semibold" style={{ color: colorForVerdict(run.evaluator?.verdict) }}>{run.evaluator?.verdict ?? "未评测"}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="text-sm font-medium text-slate-100">运行详情</div>
              {selectedRun ? <div className="mt-1 text-xs text-slate-400">{selectedRun.task_id} · created {fmtTime(selectedRun.created_at)}</div> : null}
            </div>
            <div className="max-h-[72vh] overflow-auto p-4">
              {!selectedRunId ? (
                <div className="text-sm text-slate-400">请先选择一条运行。</div>
              ) : loadingDetail ? (
                <div className="text-sm text-slate-400">正在加载运行详情...</div>
              ) : !detail ? (
                <div className="text-sm text-slate-400">未找到运行详情。</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs md:grid-cols-4">
                    <div><div className="text-[10px] text-slate-500">协议版本</div><div className="mt-1 text-slate-200">{detail.run.schema_version}</div></div>
                    <div><div className="text-[10px] text-slate-500">状态</div><div className="mt-1 text-slate-200">{detail.run.status}</div></div>
                    <div><div className="text-[10px] text-slate-500">事件数</div><div className="mt-1 text-slate-200">{detail.count}</div></div>
                    <div><div className="text-[10px] text-slate-500">评测结果</div><div className="mt-1 font-semibold" style={{ color: colorForVerdict(detail.evaluator?.verdict) }}>{detail.evaluator?.verdict ?? "未评测"}</div></div>
                  </div>
                  {detail.evaluator?.failure_type ? (
                    <div className="rounded-lg border border-rose-700/30 bg-rose-900/10 px-3 py-2 text-xs text-rose-200">
                      失败类型：{detail.evaluator.failure_type}
                    </div>
                  ) : null}
                  {detail.evaluator?.summary ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                      {detail.evaluator.summary}
                    </div>
                  ) : null}

                  {repairEpisodes.length > 0 ? (
                    <div className="rounded-lg border border-indigo-700/40 bg-indigo-900/10 p-3">
                      <div className="mb-2 text-xs font-semibold text-indigo-200">修复闭环（Failure -&gt; Action -&gt; Verify -&gt; Outcome）</div>
                      <div className="space-y-2">
                        {repairEpisodes.map((episode) => (
                          <div key={String(episode.episode_id)} className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                            <div>ID: {String(episode.episode_id)}</div>
                            <div>触发: {String(episode.trigger_step ?? "-")}</div>
                            <div>错误: {String(episode.error_summary ?? "-")}</div>
                            <div>修复动作结果: {String(episode.action_status ?? "-")}</div>
                            <div>验证结果: {String(episode.verify_status ?? "-")}</div>
                            <div>最终结果: {String(episode.outcome ?? "-")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detail.events.map((evt) => (
                    <div key={`${evt.seq}-${evt.event_type}`} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300">#{evt.seq}</span>
                          <span className={`rounded border px-2 py-0.5 text-[11px] ${colorForEventType(evt.event_type)}`}>{evt.event_type}</span>
                        </div>
                        <div className="text-slate-500">{fmtTime(evt.ts)}</div>
                      </div>
                      <div className="mb-2 text-slate-500">phase={evt.phase} · actor={evt.actor}</div>
                      <pre className="overflow-auto rounded-lg border border-slate-800 bg-[#0a1020] p-2 text-[11px] text-slate-300">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
