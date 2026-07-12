"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Clock, Globe2, Loader2, Repeat2, Sparkles, User } from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { useAuthUser } from "@/app/components/AuthHeaderActions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import { cn } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type CommunityProject = {
  id: string;
  name: string;
  userPrompt?: string;
  ownerUsername?: string | null;
  coverImageStatus?: "pending" | "ready" | "failed" | null;
  coverImageUpdatedAt?: string | null;
  allowRemix?: boolean;
  publishPreview?: boolean;
  createdAt?: string;
  updatedAt?: string;
  remixedFromTitle?: string | null;
};

const PAGE_SIZE = 24;

function hashColor(str: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    { bg: "from-orange-500/20 to-amber-500/10", text: "text-orange-600 dark:text-orange-300" },
    { bg: "from-blue-500/20 to-indigo-500/10", text: "text-blue-600 dark:text-blue-300" },
    { bg: "from-emerald-500/20 to-teal-500/10", text: "text-emerald-600 dark:text-emerald-300" },
    { bg: "from-purple-500/20 to-violet-500/10", text: "text-purple-600 dark:text-purple-300" },
    { bg: "from-rose-500/20 to-pink-500/10", text: "text-rose-600 dark:text-rose-300" },
    { bg: "from-cyan-500/20 to-sky-500/10", text: "text-cyan-600 dark:text-cyan-300" },
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function CommunityCard({
  project,
  authReady,
  remixingId,
  onRemix,
}: {
  project: CommunityProject;
  authReady: boolean;
  remixingId: string | null;
  onRemix: (projectId: string) => void;
}) {
  const hasCover = project.coverImageStatus === "ready";
  const colors = hashColor(project.id);
  const initials = (project.name || "P")
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const previewHref = `/projects/${project.id}/preview-launch`;
  const owner = project.ownerUsername?.trim() || "匿名作者";
  const allowRemix = project.allowRemix === true;
  const remixBusy = remixingId === project.id;
  const description = project.userPrompt?.trim() || "";
  const remixedFrom = project.remixedFromTitle?.trim() || "";
  const relativeTime = project.createdAt
    ? formatRelativeTime(project.createdAt, "zh-CN")
    : "";

  return (
    <div
      className={cn(
        "group/card relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-[#080a0e]",
        "transition-[box-shadow,border-color,transform] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--box-shadow-neon)]"
      )}
    >
      <a
        href={previewHref}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block w-full shrink-0 overflow-hidden bg-[#030406]"
      >
        <div
          className={cn(
            "relative aspect-[16/10] w-full overflow-hidden",
            !hasCover && `bg-gradient-to-br ${colors.bg}`,
            hasCover && "bg-[#020309]"
          )}
        >
          {hasCover ? (
            /* eslint-disable-next-line @next/next/no-img-element -- versioned app cover proxy */
            <img
              src={projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt)}
              alt=""
              className="absolute inset-0 z-0 h-full w-full object-cover object-center transition-transform duration-200 ease-out"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span
              className={cn(
                "relative z-[1] flex h-full items-center justify-center font-heading text-2xl font-bold tracking-tight sm:text-3xl",
                colors.text,
                "opacity-[0.88]"
              )}
            >
              {initials || "?"}
            </span>
          )}

          {allowRemix ? (
            <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[8px] font-mono font-bold tracking-wider text-emerald-700 backdrop-blur-md dark:text-emerald-300/90">
              <Repeat2 className="h-2.5 w-2.5" aria-hidden />
              Remix
            </span>
          ) : null}

          <span
            className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover/card:opacity-100"
            aria-hidden
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </a>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 py-3">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition-colors duration-150 group-hover/card:text-primary"
        >
          {project.name || "未命名项目"}
        </a>
        {description ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
            {description}
          </p>
        ) : (
          <p className="text-[11px] text-foreground/30">暂无描述</p>
        )}
        {remixedFrom ? (
          <p className="inline-flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground/80">
            <Repeat2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">Remix 自 {remixedFrom}</span>
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border/80 pt-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-foreground/65">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="truncate font-mono">{owner}</span>
            </span>
            {relativeTime ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                {relativeTime}
              </span>
            ) : null}
          </div>
          {allowRemix ? (
            <button
              type="button"
              disabled={!authReady || remixBusy || remixingId != null}
              onClick={() => onRemix(project.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1",
                "text-[10px] font-medium text-emerald-700 dark:text-emerald-200 transition-colors",
                "hover:bg-emerald-500/25 disabled:opacity-50"
              )}
            >
              {remixBusy ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Remix…
                </>
              ) : (
                <>
                  <Repeat2 className="h-3 w-3" aria-hidden />
                  Remix
                </>
              )}
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/70">
              <Globe2 className="h-3 w-3" aria-hidden />
              Preview
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready: authReady } = useAuthUser();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [remixError, setRemixError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number, limit: number) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    const res = await fetch(`/api/community/projects?${params.toString()}`, {
      credentials: "omit",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `加载失败（${res.status}）`);
    }
    const body = (await res.json()) as { projects?: CommunityProject[] };
    return Array.isArray(body.projects) ? body.projects : [];
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(0, PAGE_SIZE);
      setProjects(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setProjects([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(projects.length, PAGE_SIZE);
      setProjects((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      /* keep existing list */
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, projects.length]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  useEffect(() => {
    if (!remixError) return;
    const t = setTimeout(() => setRemixError(null), 5000);
    return () => clearTimeout(t);
  }, [remixError]);

  const handleRemix = useCallback(
    async (projectId: string) => {
      if (!user) {
        const redirect = pathname || "/community";
        router.push(`/auth?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      if (remixingId) return;
      setRemixingId(projectId);
      setRemixError(null);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/remix`, {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json().catch(() => ({}))) as {
          projectId?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof body.error === "string" && body.error.trim()
              ? body.error.trim()
              : `Remix 失败（${res.status}）`
          );
        }
        const nextId = typeof body.projectId === "string" ? body.projectId : "";
        if (!nextId) throw new Error("未返回新项目 ID");
        router.push(`/studio/${nextId}?remixed=1`);
      } catch (e) {
        setRemixError(e instanceof Error ? e.message : "Remix 失败");
      } finally {
        setRemixingId(null);
      }
    },
    [pathname, remixingId, router, user]
  );

  return (
    <main className="relative min-h-screen">
      <div className="relative z-[1]  mx-auto min-h-screen px-8 py-8 sm:px-6 md:py-10 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-mono tracking-wider text-primary">
              <Globe2 className="h-3 w-3" />
              COMMUNITY
            </div>
            <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              社区
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-foreground/65">
              浏览已发布的静态预览。点击卡片打开预览；编辑需作者开启 Remix 后拷贝到自己的工作区。
            </p>
          </div>
          <Link
            href="/dashboard"
            className="font-heading text-lg font-semibold tracking-tight text-muted-foreground transition-colors hover:text-primary/80 sm:text-xl"
          >
            我的项目 →
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <HamsterLoader size="sm" />
            <p className="font-mono text-xs tracking-wider text-foreground/65">加载中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <p className="text-sm text-red-400/90">{error}</p>
            <button
              type="button"
              onClick={() => void loadInitial()}
              className="rounded-xl border border-border px-4 py-2 text-[12px] text-muted-foreground hover:bg-muted"
            >
              重试
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted/40">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold text-foreground">还没有发布的作品</h2>
              <p className="text-sm text-foreground/65">
                作者在 Studio 开启「发布预览」后，作品会出现在这里
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <CommunityCard
                  key={project.id}
                  project={project}
                  authReady={authReady}
                  remixingId={remixingId}
                  onRemix={(id) => void handleRemix(id)}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="flex min-h-14 items-center justify-center py-6">
              {loadingMore ? (
                <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-foreground/65">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载更多…
                </div>
              ) : !hasMore ? (
                <span className="font-mono text-[11px] tracking-wider text-foreground/55">
                  已加载全部
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

      {remixError ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl border border-red-400/30 bg-[#1a0c0c] px-4 py-2.5 text-center text-[12px] text-red-200 shadow-lg"
        >
          {remixError}
        </div>
      ) : null}
    </main>
  );
}
