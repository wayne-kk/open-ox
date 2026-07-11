"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe2, Sparkles } from "lucide-react";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import { cn } from "@/lib/utils";

type CommunityProject = {
  id: string;
  name: string;
  ownerUsername?: string | null;
  coverImageStatus?: "pending" | "ready" | "failed" | null;
  coverImageUpdatedAt?: string | null;
  allowRemix?: boolean;
};

const PREVIEW_LIMIT = 8;

function hashColor(str: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    { bg: "from-orange-950/80 to-amber-950/60", text: "text-orange-300" },
    { bg: "from-blue-950/80 to-indigo-950/60", text: "text-blue-300" },
    { bg: "from-emerald-950/80 to-teal-950/60", text: "text-emerald-300" },
    { bg: "from-purple-950/80 to-violet-950/60", text: "text-purple-300" },
    { bg: "from-rose-950/80 to-pink-950/60", text: "text-rose-300" },
    { bg: "from-cyan-950/80 to-sky-950/60", text: "text-cyan-300" },
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

export function HomeCommunityPreview() {
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/community/projects?offset=0&limit=${PREVIEW_LIMIT}`,
          { credentials: "omit" }
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { projects?: CommunityProject[] };
        if (!cancelled) {
          setProjects(Array.isArray(body.projects) ? body.projects : []);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]"
          />
        ))}
      </div>
    );
  }

  if (failed || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] py-16">
        <Sparkles className="h-7 w-7 text-primary/40" />
        <p className="text-sm text-muted-foreground">
          {failed ? "暂时无法加载社区作品" : "还没有发布的社区作品"}
        </p>
        <Link
          href="/community"
          className="font-mono text-[12px] text-primary/80 transition-colors hover:text-primary"
        >
          前往社区 →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {projects.map((project) => {
        const hasCover = project.coverImageStatus === "ready";
        const colors = hashColor(project.id);
        const initials = (project.name || "P")
          .split(/[\s-_]+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");
        const previewHref = `/projects/${project.id}/preview-launch`;
        const owner = project.ownerUsername?.trim() || "匿名作者";

        return (
          <a
            key={project.id}
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080a0e]",
              "transition-[box-shadow,border-color] duration-200",
              "hover:border-primary/40 hover:shadow-[var(--box-shadow-neon)]"
            )}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#030406] p-2">
              <div
                className={cn(
                  "relative h-full w-full overflow-hidden rounded-[10px] ring-1 ring-inset ring-white/[0.07]",
                  !hasCover && `bg-gradient-to-br ${colors.bg}`,
                  hasCover && "bg-[#020309]"
                )}
              >
                {hasCover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- versioned cover proxy
                  <img
                    src={projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt)}
                    alt=""
                    className="h-full w-full object-contain object-center"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span
                    className={cn(
                      "flex h-full items-center justify-center font-heading text-2xl font-bold",
                      colors.text,
                      "opacity-80"
                    )}
                  >
                    {initials || "?"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white transition-colors group-hover:text-primary">
                  {project.name || "未命名项目"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-white/60">{owner}</p>
              </div>
              {project.allowRemix ? (
                <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider text-emerald-300/90">
                  Remix
                </span>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function HomeCommunitySectionHeader() {
  return (
    <div className="mt-12 mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2.5 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-[-0.035em]">
          <Globe2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          发现社区作品
        </h2>
      </div>
      <Link
        href="/community"
        className="defi-button-outline h-9 shrink-0 px-4 text-[13px]"
      >
        查看全部 →
      </Link>
    </div>
  );
}
