"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowRight, Clock, Globe2, Repeat2, Sparkles, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

type CommunityProject = {
  id: string;
  name: string;
  userPrompt?: string;
  ownerUsername?: string | null;
  coverImageStatus?: "pending" | "ready" | "failed" | null;
  coverImageUpdatedAt?: string | null;
  allowRemix?: boolean;
  createdAt?: string;
  remixedFromTitle?: string | null;
};

const PREVIEW_LIMIT = 8;

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

function CommunityPreviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
          aria-hidden
        >
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="flex flex-col gap-2 px-3.5 py-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="flex items-center gap-2 border-t border-border/80 pt-2.5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
              <div className="ml-auto h-3 w-14 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeCommunityPreview() {
  const t = useTranslations("landing");
  const locale = useLocale();
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
    return <CommunityPreviewSkeleton />;
  }

  if (failed || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-muted/30 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/50">
          <Sparkles className="h-6 w-6 text-primary/45" />
        </div>
        <p className="text-sm text-muted-foreground">
          {failed ? t("communityFailed") : t("communityEmpty")}
        </p>
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-primary/80 transition-colors hover:text-primary"
        >
          {t("communityCta")}
          <ArrowRight className="h-3.5 w-3.5" />
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
        const owner = project.ownerUsername?.trim() || t("anonymousAuthor");
        const allowRemix = project.allowRemix === true;
        const description = project.userPrompt?.trim() || "";
        const remixedFrom = project.remixedFromTitle?.trim() || "";
        const relativeTime = project.createdAt
          ? formatRelativeTime(project.createdAt, locale)
          : "";

        return (
          <a
            key={project.id}
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            data-hoverable="true"
            className="group/card ox-project-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div
              className={cn(
                "relative aspect-[16/10] w-full overflow-hidden",
                !hasCover && `bg-gradient-to-br ${colors.bg}`,
                hasCover && "bg-muted"
              )}
            >
              {hasCover ? (
                // eslint-disable-next-line @next/next/no-img-element -- versioned cover proxy; avoid next/image optimizer on auth-gated API
                <img
                  src={projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt)}
                  alt=""
                  width={640}
                  height={400}
                  className="ox-card-cover ox-card-cover-zoom absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  className={cn(
                    "relative z-[1] flex h-full items-center justify-center font-heading text-2xl font-bold",
                    colors.text,
                    "opacity-80"
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
                className="ox-card-affordance pointer-events-none absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/90 backdrop-blur-md"
                aria-hidden
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 py-3">
              <p className="ox-card-title ox-card-title-accent line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                {project.name || t("untitledProject")}
              </p>
              {description ? (
                <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
                  {description}
                </p>
              ) : (
                <p className="text-[11px] text-foreground/30">{t("noDescription")}</p>
              )}
              {remixedFrom ? (
                <p className="inline-flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground/80">
                  <Repeat2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{t("remixedFrom", { title: remixedFrom })}</span>
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/80 pt-2.5">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                  <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate font-mono">{owner}</span>
                </span>
                {relativeTime ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    {relativeTime}
                  </span>
                ) : null}
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/80 transition-colors group-hover/card:text-primary">
                  <Globe2 className="h-3 w-3" aria-hidden />
                  Preview
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function HomeCommunitySectionHeader() {
  const t = useTranslations("landing");

  return (
    <div className="mt-12 mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2.5 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-[-0.035em]">
          <Globe2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          {t("communityTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("communitySubtitle")}</p>
      </div>
      <Link
        href="/community"
        className="defi-button-outline inline-flex h-9 shrink-0 items-center gap-1.5 px-4 text-[13px]"
      >
        {t("communityViewAll")}
        <ArrowRight className="h-3.5 w-3.5 opacity-70" />
      </Link>
    </div>
  );
}
