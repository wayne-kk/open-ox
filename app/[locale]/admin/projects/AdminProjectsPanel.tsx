"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

type AdminProject = {
  id: string;
  name: string;
  status: string;
  ownerUsername: string | null;
  publishPreview: boolean;
  allowRemix: boolean;
  staticPreviewSyncedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

const PAGE_SIZE = 50;

export function AdminProjectsPanel() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unlistingId, setUnlistingId] = useState<string | null>(null);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    const res = await fetch(`/api/admin/projects?${params.toString()}`);
    const json = (await res.json()) as {
      success?: boolean;
      data?: { projects?: AdminProject[] };
      error?: string | null;
    };
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error ?? "Failed to load projects");
    }
    return Array.isArray(json.data.projects) ? json.data.projects : [];
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(0);
      setProjects(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProjects([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(projects.length);
      setProjects((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, projects.length]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function forceUnlist(projectId: string) {
    if (unlistingId) return;
    const ok = window.confirm("确认强制下架？将关闭发布预览与 Remix，项目仍保留在作者工作区。");
    if (!ok) return;
    setUnlistingId(projectId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/unlist`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { publishPreview?: boolean; allowRemix?: boolean };
        error?: string | null;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "强制下架失败");
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, publishPreview: false, allowRemix: false }
            : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUnlistingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">项目管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全量项目 · 排障与强制下架（不影响作者工作区副本）
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="overflow-hidden rounded-md border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">项目</th>
                <th className="px-3 py-2">作者</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">发布</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                    加载中…
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                    没有数据
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const owner = project.ownerUsername?.trim() || "—";
                  const previewHref = `/site-previews/${encodeURIComponent(project.id)}`;
                  return (
                    <tr key={project.id} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{project.name || "未命名"}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {project.id.slice(0, 8)}…
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{owner}</td>
                      <td className="px-3 py-2 font-mono text-xs">{project.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {project.publishPreview ? (
                            <span className="rounded-md border border-primary/35 bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                              已发布
                            </span>
                          ) : (
                            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                              私有
                            </span>
                          )}
                          {project.allowRemix ? (
                            <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                              Remix
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/studio/${project.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Studio
                          </Link>
                          {project.publishPreview ? (
                            <a
                              href={previewHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                              预览
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {project.publishPreview ? (
                            <button
                              type="button"
                              className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 disabled:opacity-40"
                              disabled={unlistingId === project.id}
                              onClick={() => void forceUnlist(project.id)}
                            >
                              {unlistingId === project.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  下架中
                                </span>
                              ) : (
                                "强制下架"
                              )}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="h-9 rounded-md border border-white/20 bg-white/5 px-4 text-sm disabled:opacity-50"
            >
              {loadingMore ? "加载中…" : "加载更多"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
