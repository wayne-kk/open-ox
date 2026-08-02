"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";

type Job = {
  id: string;
  project_id: string;
  action: string;
  status: string;
  attempts: number;
  pending_engines: string[];
  last_error: string | null;
  created_at: string;
};

type StatusPayload = {
  data?: {
    sitemap: { projectCount: number; projectShards: number };
    counts: Record<string, number>;
    jobs: Job[];
  };
  error?: string;
};

async function fetchStatusPayload(): Promise<StatusPayload> {
  const response = await fetch("/api/admin/search-discovery", { cache: "no-store" });
  const body = await response.json() as StatusPayload;
  if (!response.ok && !body.error) body.error = `HTTP ${response.status}`;
  return body;
}

export function SearchDiscoveryPanel() {
  const [payload, setPayload] = useState<StatusPayload["data"]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const load = useCallback(async () => {
    const body = await fetchStatusPayload();
    if (!body.data) setError(body.error || "加载失败");
    else { setPayload(body.data); setError(undefined); }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchStatusPayload().then((body) => {
      if (!active) return;
      if (!body.data) setError(body.error || "加载失败");
      else { setPayload(body.data); setError(undefined); }
    });
    return () => { active = false; };
  }, []);

  const retry = async (jobId: string) => {
    setBusy(jobId);
    await fetch("/api/admin/search-discovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    setBusy(undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-xl font-semibold">搜索发现</h1><p className="mt-1 text-sm text-muted-foreground">Sitemap、IndexNow 与百度推送状态</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border" title="刷新">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {error ? <p className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{error}</p> : null}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-6">
        {[
          ["可索引项目", payload?.sitemap.projectCount ?? 0], ["Sitemap 分片", payload?.sitemap.projectShards ?? 0],
          ["等待", payload?.counts.pending ?? 0], ["处理中", payload?.counts.processing ?? 0],
          ["完成", payload?.counts.completed ?? 0], ["死信", payload?.counts.dead ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="bg-background p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
      </div>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-3">项目</th><th>动作</th><th>状态</th><th>Adapter</th><th>尝试</th><th>创建时间</th><th className="w-12" /></tr></thead>
          <tbody>{(payload?.jobs ?? []).map((job) => <tr key={job.id} className="border-t border-border">
            <td className="max-w-52 truncate px-3 py-3 font-mono text-xs" title={job.project_id}>{job.project_id}</td><td>{job.action}</td><td>{job.status}</td><td>{job.pending_engines.join(", ") || "-"}</td><td>{job.attempts}</td><td>{new Date(job.created_at).toLocaleString()}</td>
            <td>{job.status === "dead" ? <button type="button" disabled={busy === job.id} onClick={() => void retry(job.id)} className="inline-flex h-8 w-8 items-center justify-center" title={job.last_error || "重试"}><RotateCcw className="h-4 w-4" /></button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
