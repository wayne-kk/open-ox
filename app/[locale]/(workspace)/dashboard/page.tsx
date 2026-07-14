"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trash2, Plus, FolderInput, Folder,
  AlertCircle, Loader2, Sparkles,
  AlertTriangle, MoreHorizontal, Globe2, FolderCog, Check, Pencil,
  Repeat2, Clock, ArrowUpRight, Rocket, ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { openOxVercelReconnectHref } from "@/lib/vercel/dashboardUrl";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { captureAppReturnTo } from "@/lib/navigation/appBack";
import { useAuthUser, useAuthProfile } from "@/app/components/AuthHeaderActions";
import {
  patchProjectPublish,
  type ProjectPublishState,
} from "@/app/components/ProjectPublishPanel";
import { fetchProjectGalleryDeduped } from "@/lib/projectGalleryClient";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import {
  COVER_CAPTURE_POLL_INTERVAL_MS,
  COVER_CAPTURE_POLL_TIMEOUT_MS,
  evaluateCoverCapturePoll,
} from "@/lib/coverCaptureOrchestration";
import { cn } from "@/lib/utils";
import { WORKSPACE_PROMPT_ID } from "@/app/components/AppShell";
import { HeroPrompt } from "@/app/components/HeroPrompt";
import {
  isRootFolderParam,
  notifyFoldersChanged,
} from "@/lib/projectFolders";
import { getUserDisplayName } from "@/lib/auth/display-name";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectMetadata {
  id: string;
  name: string;
  userPrompt: string;
  status: "generating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  folderId?: string | null;
  modificationHistory: unknown[];
  ownerUserId?: string;
  ownerUsername?: string | null;
  coverImageStatus?: "pending" | "ready" | "failed" | null;
  coverImageUpdatedAt?: string | null;
  publishPreview?: boolean;
  allowRemix?: boolean;
  staticPreviewSyncedAt?: string | null;
}

interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString();
}

// Deterministic color from string hash
function hashColor(str: string): { bg: string; text: string; accent: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    { bg: "from-orange-500/20 to-amber-500/10", text: "text-orange-600 dark:text-orange-300", accent: "bg-orange-500/20" },
    { bg: "from-blue-500/20 to-indigo-500/10", text: "text-blue-600 dark:text-blue-300", accent: "bg-blue-500/20" },
    { bg: "from-emerald-500/20 to-teal-500/10", text: "text-emerald-600 dark:text-emerald-300", accent: "bg-emerald-500/20" },
    { bg: "from-purple-500/20 to-violet-500/10", text: "text-purple-600 dark:text-purple-300", accent: "bg-purple-500/20" },
    { bg: "from-rose-500/20 to-pink-500/10", text: "text-rose-600 dark:text-rose-300", accent: "bg-rose-500/20" },
    { bg: "from-cyan-500/20 to-sky-500/10", text: "text-cyan-600 dark:text-cyan-300", accent: "bg-cyan-500/20" },
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function ProjectCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card"
      aria-hidden
    >
      <div className="aspect-[16/10] w-full animate-pulse bg-muted" />
      <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="mt-0.5 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border/80 pt-2.5">
          <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project, onDelete, onClick, deleting, canDelete, onPublishChange, folders, onMove,
}: {
  project: ProjectMetadata;
  onDelete: () => void;
  onClick: () => void;
  deleting: boolean;
  canDelete: boolean;
  onPublishChange: (projectId: string, state: ProjectPublishState) => void;
  folders: ProjectFolder[];
  onMove: (folderId: string | null) => void;
}) {
  const isReady = project.status === "ready";
  const isFailed = project.status === "failed";
  const isGenerating = project.status === "generating";
  /** Studio 在生成中会轮询进度，列表应可进入 */
  const isClickable = isReady || isFailed || isGenerating;
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverOverride, setCoverOverride] = useState<{
    status: "pending" | "ready" | "failed" | null;
    updatedAt: string | null;
  } | null>(null);
  const coverStatus = coverOverride?.status ?? project.coverImageStatus ?? null;
  const coverUpdatedAt = coverOverride?.updatedAt ?? project.coverImageUpdatedAt ?? null;
  const hasCover = coverStatus === "ready";
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverSrc = hasCover
    ? projectCoverDisplayUrl(project.id, coverUpdatedAt)
    : null;
  const showCoverImage = Boolean(coverSrc) && !coverFailed;

  useEffect(() => {
    setCoverOverride(null);
  }, [project.id]);

  useEffect(() => {
    setCoverLoaded(false);
    setCoverFailed(false);
  }, [coverSrc]);

  useEffect(() => {
    if (!showCoverImage) return;
    const img = coverImgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setCoverLoaded(true);
    } else if (img.complete && img.naturalWidth === 0) {
      setCoverFailed(true);
    }
  }, [showCoverImage, coverSrc]);

  const colors = hashColor(project.id);
  const initials = (project.name || "P")
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const publishPreview = project.publishPreview === true;
  const allowRemix = project.allowRemix === true;
  const hasStaticPreview =
    typeof project.staticPreviewSyncedAt === "string" &&
    project.staticPreviewSyncedAt.trim().length > 0;

  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deployConfirmOpen, setDeployConfirmOpen] = useState(false);
  const [deployBusy, setDeployBusy] = useState(false);

  const openStudioOrPreview = (e: React.MouseEvent) => {
    if (!isClickable) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(`/projects/${project.id}/preview-launch`, "_blank");
      return;
    }
    onClick();
  };

  const openPreviewTab = (e: React.MouseEvent) => {
    if (!isClickable || e.button !== 1) return;
    e.preventDefault();
    window.open(`/projects/${project.id}/preview-launch`, "_blank");
  };

  const togglePublish = async (next: boolean) => {
    if (publishBusy) return;
    setPublishBusy(true);
    setPublishError(null);
    const result = await patchProjectPublish(project.id, { publishPreview: next });
    setPublishBusy(false);
    if (!result.ok) {
      setPublishError(
        result.code === "STATIC_PREVIEW_REQUIRED"
          ? "需要先有静态预览"
          : result.error
      );
      return;
    }
    onPublishChange(project.id, result.state);
  };

  const toggleRemix = async (next: boolean) => {
    if (publishBusy || !publishPreview) return;
    setPublishBusy(true);
    setPublishError(null);
    const result = await patchProjectPublish(project.id, { allowRemix: next });
    setPublishBusy(false);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    onPublishChange(project.id, result.state);
  };

  const runDeploy = async () => {
    if (deployBusy || !isClickable) return;
    setDeployBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (body.code === "VERCEL_NOT_CONNECTED") {
          setDeployConfirmOpen(false);
          toast.message("需要先连接 Vercel", {
            description: "授权后即可一键部署到你的账号。",
          });
          window.location.href = openOxVercelReconnectHref();
          return;
        }
        toast.error("部署失败", {
          description: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setDeployConfirmOpen(false);
      toast.message("部署已开始", {
        description: "约 1–3 分钟。可在「集成 & 部署」查看进度与线上 URL。",
        action: {
          label: "查看",
          onClick: () => {
            window.location.href = "/settings/integrations";
          },
        },
      });
    } catch (e) {
      toast.error("部署失败", {
        description: e instanceof Error ? e.message : "网络错误",
      });
    } finally {
      setDeployBusy(false);
    }
  };

  const requestCoverCapture = async () => {
    if (coverBusy || isGenerating || !isClickable) return;
    setCoverBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/cover/capture`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        baselineUpdatedAt?: string | null;
      };
      if (res.status === 401) {
        toast.error("请先登录后再更新封面");
        return;
      }
      if (res.status === 403) {
        toast.error("仅项目所有者可以更新封面");
        return;
      }
      if (res.status === 503) {
        toast.error("封面截图暂不可用", {
          description: "服务端未配置 SUPABASE_SERVICE_ROLE_KEY",
        });
        return;
      }
      if (res.status !== 202 && res.status !== 409) {
        toast.error("更新封面失败", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }

      const baselineUpdatedAt = data.baselineUpdatedAt ?? null;
      toast.message(res.status === 409 ? "封面已在截取中…" : "正在截取封面…");

      const started = Date.now();
      while (Date.now() - started < COVER_CAPTURE_POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, COVER_CAPTURE_POLL_INTERVAL_MS));
        const pollRes = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
          credentials: "include",
        });
        if (!pollRes.ok) continue;
        const body = (await pollRes.json().catch(() => null)) as {
          coverImageStatus?: string | null;
          coverImageUpdatedAt?: string | null;
          coverImageError?: string | null;
        } | null;
        if (!body) continue;
        const step = evaluateCoverCapturePoll({
          baselineUpdatedAt,
          status: body.coverImageStatus,
          updatedAt: body.coverImageUpdatedAt,
          error: body.coverImageError,
          elapsedMs: Date.now() - started,
        });
        if (step.verdict === "success") {
          setCoverOverride({
            status: "ready",
            updatedAt: body.coverImageUpdatedAt ?? new Date().toISOString(),
          });
          toast.success("封面已更新");
          return;
        }
        if (step.verdict === "failed") {
          toast.error("封面截取失败", {
            description: step.errorHint ?? "请稍后重试",
          });
          return;
        }
        if (step.verdict === "timeout") break;
      }
      toast.message("截取仍在处理", {
        description: "请稍后刷新页面查看新封面",
      });
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setCoverBusy(false);
    }
  };

  const statusBadge = publishPreview
    ? {
      icon: Globe2,
      label: "已发布",
      className: "border-primary/40 bg-background/80 text-primary",
      spin: false,
    }
    : isGenerating
      ? {
        icon: Loader2,
        label: "生成中",
        className: "border-border bg-background/80 text-primary",
        spin: true,
      }
      : isFailed
        ? {
          icon: AlertCircle,
          label: "失败",
          className: "border-red-400/30 bg-background/80 text-red-600 dark:text-red-300",
          spin: false,
        }
        : null;
  const StatusIcon = statusBadge?.icon;

  const menuItemClass =
    "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground/90 outline-none focus:bg-muted focus:!text-foreground focus:!**:text-foreground data-[highlighted]:bg-muted data-[highlighted]:!text-foreground data-[highlighted]:!**:text-foreground";

  const folderName = project.folderId
    ? folders.find((f) => f.id === project.folderId)?.name?.trim() || null
    : null;

  return (
    <article
      data-hoverable={isClickable ? "true" : "false"}
      className={cn(
        "group/card ox-project-card relative flex h-full flex-col overflow-hidden rounded-xl",
        "border border-border bg-card",
        isFailed && "border-red-400/20",
        isGenerating && "border-primary/20",
        !isClickable && "opacity-80"
      )}
    >
      <button
        type="button"
        disabled={!isClickable}
        onClick={openStudioOrPreview}
        onAuxClick={openPreviewTab}
        title={
          isClickable
            ? isGenerating
              ? "进入 Studio 查看生成进度（⌘/Ctrl 点击打开预览）"
              : "进入 Studio；⌘/Ctrl 或中键打开站点预览"
            : undefined
        }
        className={cn(
          "relative block w-full overflow-hidden text-left aspect-[16/10]",
          !showCoverImage && `bg-gradient-to-br ${colors.bg}`,
          showCoverImage && "bg-muted",
          isClickable
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
            : "cursor-default"
        )}
      >
        {showCoverImage && coverSrc ? (
          <>
            {!coverLoaded ? (
              <div className="absolute inset-0 z-[1] animate-pulse bg-muted" aria-hidden />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- versioned app cover proxy */}
            <img
              ref={coverImgRef}
              src={coverSrc}
              alt=""
              className={cn(
                "ox-card-cover absolute inset-0 z-0 h-full w-full object-cover object-center",
                isClickable && "ox-card-cover-zoom",
                coverLoaded ? "opacity-100" : "opacity-0"
              )}
              loading="lazy"
              decoding="async"
              onLoad={() => setCoverLoaded(true)}
              onError={() => {
                setCoverFailed(true);
                setCoverLoaded(false);
              }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <span
              className={cn(
                "relative z-[1] flex h-full items-center justify-center font-heading text-2xl font-bold tracking-tight sm:text-3xl",
                colors.text,
                "opacity-80"
              )}
            >
              {initials || "?"}
            </span>
          </>
        )}

        {isGenerating && (
          <div className="pointer-events-none absolute inset-0 z-10 animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        )}

        {statusBadge && StatusIcon ? (
          <span
            className={cn(
              "pointer-events-none absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 backdrop-blur-md",
              statusBadge.className
            )}
          >
            <StatusIcon
              className={cn("h-3 w-3 shrink-0", statusBadge.spin && "animate-spin")}
            />
            <span className="text-[9px] font-medium tracking-wide">
              {statusBadge.label}
            </span>
          </span>
        ) : null}

        {isClickable ? (
          <span
            className="ox-card-affordance pointer-events-none absolute bottom-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/85 text-foreground backdrop-blur-md"
            aria-hidden
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            disabled={!isClickable}
            onClick={openStudioOrPreview}
            onAuxClick={openPreviewTab}
            className={cn(
              "ox-card-title min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-foreground/95 line-clamp-2",
              isClickable
                ? "ox-card-title-accent cursor-pointer focus-visible:outline-none focus-visible:text-primary"
                : "cursor-default"
            )}
          >
            {project.name || "未命名项目"}
          </button>
          {canDelete ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 data-[state=open]:bg-muted data-[state=open]:text-foreground data-[state=open]:opacity-100"
                  title="更多"
                  aria-label="项目操作"
                >
                  {publishBusy || coverBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 overflow-visible rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--box-shadow-neon-lg)] ring-0"
              >
                <DropdownMenuItem
                  disabled={publishBusy || (!hasStaticPreview && !publishPreview)}
                  className={menuItemClass}
                  onSelect={(e) => {
                    e.preventDefault();
                    void togglePublish(!publishPreview);
                  }}
                >
                  <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {publishPreview ? "取消发布" : "发布到社区"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={publishBusy || !publishPreview}
                  className={menuItemClass}
                  onSelect={(e) => {
                    e.preventDefault();
                    void toggleRemix(!allowRemix);
                  }}
                >
                  <Repeat2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {allowRemix ? "关闭 Remix" : "允许 Remix"}
                </DropdownMenuItem>
                {!hasStaticPreview && !publishPreview ? (
                  <p className="px-2.5 pb-1.5 pt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    需先有静态预览才能发布
                  </p>
                ) : null}
                <DropdownMenuSeparator className="mx-0 my-1 bg-muted" />
                <DropdownMenuItem
                  disabled={!isClickable || deployBusy}
                  className={menuItemClass}
                  onSelect={() => {
                    if (!isClickable || deployBusy) return;
                    setDeployConfirmOpen(true);
                  }}
                >
                  <Rocket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  部署到 Vercel
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!isClickable || isGenerating || coverBusy}
                  className={menuItemClass}
                  onSelect={(e) => {
                    e.preventDefault();
                    void requestCoverCapture();
                  }}
                >
                  {coverBusy ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  更新封面
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-0 my-1 bg-muted" />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    className={cn(
                      menuItemClass,
                      "bg-transparent focus:bg-muted data-[state=open]:bg-muted data-[state=open]:!text-foreground data-[state=open]:!**:text-foreground data-open:bg-muted data-open:!text-foreground data-open:!**:text-foreground"
                    )}
                  >
                    <FolderInput className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 whitespace-nowrap text-left">移动到文件夹</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 w-48 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--box-shadow-neon-lg)] ring-0">
                    <DropdownMenuItem
                      disabled={!project.folderId}
                      className={menuItemClass}
                      onSelect={(e) => {
                        e.preventDefault();
                        if (!project.folderId) return;
                        onMove(null);
                      }}
                    >
                      <span className="flex-1">最外层</span>
                      {!project.folderId ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                    </DropdownMenuItem>
                    {folders.map((f) => {
                      const current = project.folderId === f.id;
                      return (
                        <DropdownMenuItem
                          key={f.id}
                          disabled={current}
                          className={menuItemClass}
                          onSelect={(e) => {
                            e.preventDefault();
                            if (current) return;
                            onMove(f.id);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          {current ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator className="mx-0 my-1 bg-muted" />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={deleting}
                  className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-red-400 focus:bg-red-500/12 focus:!text-red-400 focus:!**:text-red-400 data-[highlighted]:bg-red-500/12 data-[highlighted]:!text-red-400 data-[highlighted]:!**:text-red-400"
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  删除项目
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {project.userPrompt?.trim() ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
            {project.userPrompt.trim()}
          </p>
        ) : (
          <p className="text-[11px] text-foreground/30">暂无描述</p>
        )}

        {publishError ? (
          <p className="text-[10px] text-red-400/85">{publishError}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/80 pt-2.5">
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {timeAgo(project.createdAt)}
          </span>
          {folderName ? (
            <span className="inline-flex min-w-0 max-w-[40%] items-center gap-1 text-[10px] text-muted-foreground">
              <Folder className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{folderName}</span>
            </span>
          ) : null}
          {allowRemix && publishPreview ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300/90">
              <Repeat2 className="h-3 w-3 shrink-0" aria-hidden />
              Remix
            </span>
          ) : null}
        </div>
      </div>

      {deployConfirmOpen ? (
        <ConfirmDeployModal
          projectName={project.name || "未命名项目"}
          busy={deployBusy}
          onConfirm={() => void runDeploy()}
          onCancel={() => {
            if (deployBusy) return;
            setDeployConfirmOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

/* ── Confirm Dissolve Folder Modal ── */
function ConfirmDeleteFolderModal({
  folderName,
  projectCount,
  onConfirm,
  onCancel,
}: {
  folderName: string;
  projectCount: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const countLabel =
    projectCount === null ? "…" : String(projectCount);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">解散文件夹</h3>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-1">
          解散「<span className="text-foreground/90 font-medium">{folderName}</span>」？
        </p>
        <p className="text-[12px] text-muted-foreground mb-6">
          夹内 {countLabel} 个项目将回到最外层，项目本身不会被删除。
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-foreground bg-amber-500/80 hover:bg-amber-500 border border-amber-500/40 transition-colors"
          >
            确认解散
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageFoldersModal({
  folders,
  onClose,
  onCreated,
  onRenamed,
  onRequestDissolve,
}: {
  folders: ProjectFolder[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onRenamed: () => Promise<void>;
  onRequestDissolve: (folderId: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "创建失败");
        return;
      }
      setNewName("");
      await onCreated();
      notifyFoldersChanged();
    } finally {
      setCreating(false);
    }
  };

  const startRename = (f: ProjectFolder) => {
    setEditingId(f.id);
    setEditName(f.name);
    setError(null);
  };

  const saveRename = async (id: string) => {
    const name = editName.trim();
    if (!name || savingId) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "重命名失败");
        return;
      }
      setEditingId(null);
      await onRenamed();
      notifyFoldersChanged();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">管理文件夹</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            关闭
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 pl-3 pr-1.5 py-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新文件夹名称"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground/90 outline-none placeholder:text-foreground/30"
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            />
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void handleCreate()}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-primary/20 text-primary disabled:opacity-30"
            >
              创建
            </button>
          </div>

          {error ? <p className="text-[12px] text-red-400/85">{error}</p> : null}

          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {folders.length === 0 ? (
              <li className="py-6 text-center text-[12px] text-muted-foreground">还没有文件夹</li>
            ) : (
              folders.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2"
                >
                  {editingId === f.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary/40"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveRename(f.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingId === f.id || !editName.trim()}
                        onClick={() => void saveRename(f.id)}
                        className="rounded-md px-2 py-1 text-[11px] text-primary hover:bg-primary/10 disabled:opacity-30"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">{f.name}</span>
                      <button
                        type="button"
                        title="重命名"
                        onClick={() => startRename(f)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="解散文件夹"
                        onClick={() => onRequestDissolve(f.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeployModal({
  projectName,
  busy,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">部署到 Vercel？</h3>
        </div>
        <p className="mb-1 text-[13px] leading-relaxed text-muted-foreground">
          将把{" "}
          <span className="font-medium text-foreground/90">&ldquo;{projectName}&rdquo;</span>{" "}
          推送到你自己的 Vercel 账号。
        </p>
        <p className="mb-6 text-[12px] text-muted-foreground/75">
          约 1–3 分钟。可在「集成 & 部署」查看进度与线上 URL；未连接时会先引导授权。
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-border px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/15 px-3.5 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/22 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            {busy ? "开始中…" : "确认部署"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">确认删除</h3>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-1">
          确定要删除项目 <span className="text-foreground/90 font-medium">&ldquo;{projectName}&rdquo;</span> 吗？
        </p>
        <p className="text-[12px] text-red-400/60 mb-6">此操作不可撤销，项目所有数据将被永久删除。</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-foreground bg-red-500/80 hover:bg-red-500 border border-red-500/40 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Deleting Overlay ── */
function DeletingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <HamsterLoader size="sm" />
        <p className="font-mono text-sm text-muted-foreground tracking-wider">{label}</p>
        <p className="font-mono text-[10px] text-foreground/55">请勿关闭页面</p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen  flex items-center justify-center">
          <p className="font-mono text-sm text-foreground/65">加载…</p>
        </main>
      }
    >
      <ProjectsPageContent />
    </Suspense>
  );
}

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, ready: authReady } = useAuthUser();
  const { isAdmin } = useAuthProfile();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [manageFoldersOpen, setManageFoldersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingFolder, setSwitchingFolder] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [pendingDissolveCount, setPendingDissolveCount] = useState<number | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const galleryRequestKeyRef = useRef<string>("");
  const loadedFolderRef = useRef<string | null>(null);
  const projectsRef = useRef<ProjectMetadata[]>([]);
  projectsRef.current = projects;

  const applyFolderFilter = useCallback(
    (next: string) => {
      setPublishedOnly(false);
      setFolderFilter(next);
      const path =
        next === "all"
          ? "/dashboard?mine=1&folder=all"
          : `/dashboard?mine=1&folder=${encodeURIComponent(next)}`;
      router.replace(path, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const published =
      searchParams.get("published") === "1" || searchParams.get("published") === "true";
    setPublishedOnly((prev) => (prev === published ? prev : published));
    if (published) {
      setFolderFilter((prev) => (prev === "all" ? prev : "all"));
      return;
    }
    const f = searchParams.get("folder");
    const next = isRootFolderParam(f) ? "all" : f!;
    setFolderFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const folderQuery = isRootFolderParam(folderFilter) ? "all" : folderFilter;
  const listScopeKey = publishedOnly ? "published" : folderQuery;
  const authUserId = authUser?.id ?? null;

  type GalleryPagePayload = {
    projects: ProjectMetadata[];
  };

  const fetchProjectsPage = useCallback(
    async (
      offset: number,
      limit: number,
      folder: string,
      published: boolean
    ): Promise<GalleryPagePayload | null> => {
      try {
        const params = new URLSearchParams();
        params.set("offset", String(offset));
        params.set("limit", String(limit));
        params.set("mine", "1");
        if (published) {
          params.set("published", "1");
        } else {
          params.set("folder", folder);
        }
        const galleryUrl = `/api/projects/gallery?${params.toString()}`;
        const res = await fetchProjectGalleryDeduped(galleryUrl);
        if (res.status === 401) {
          router.push(`/auth?redirect=${encodeURIComponent("/dashboard")}`);
          return null;
        }
        if (!res.ok) return null;
        return (await res.json()) as GalleryPagePayload;
      } catch {
        return null;
      }
    },
    [router]
  );

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      setFolders((await res.json()) as ProjectFolder[]);
    }
  }, []);

  const loadInitialProjects = useCallback(
    async (scope: string, published: boolean, opts?: { soft?: boolean }) => {
      const requestKey = `${scope}|0|${PAGE_SIZE}`;
      galleryRequestKeyRef.current = requestKey;
      const soft = opts?.soft ?? loadedFolderRef.current !== null;
      if (soft) setSwitchingFolder(true);
      else setLoading(true);

      const payload = await fetchProjectsPage(0, PAGE_SIZE, scope, published);
      if (galleryRequestKeyRef.current !== requestKey) return;
      if (payload) {
        setProjects(payload.projects);
        setHasMore(payload.projects.length === PAGE_SIZE);
        loadedFolderRef.current = scope;
      }
      setLoading(false);
      setSwitchingFolder(false);
    },
    [fetchProjectsPage]
  );

  const loadMoreProjects = useCallback(async () => {
    if (loading || switchingFolder || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const payload = await fetchProjectsPage(
      projects.length,
      PAGE_SIZE,
      folderQuery,
      publishedOnly
    );
    if (payload) {
      setProjects((prev) => [...prev, ...payload.projects]);
      setHasMore(payload.projects.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [
    fetchProjectsPage,
    folderQuery,
    publishedOnly,
    hasMore,
    loading,
    loadingMore,
    projects.length,
    switchingFolder,
  ]);

  const refreshLoadedProjects = useCallback(async () => {
    const loadedCount = projectsRef.current.length;
    if (loadedCount === 0) return;
    const scope = loadedFolderRef.current ?? listScopeKey;
    const payload = await fetchProjectsPage(0, loadedCount, scope, publishedOnly);
    if (payload) {
      setProjects(payload.projects);
      setHasMore(payload.projects.length === loadedCount);
    }
  }, [fetchProjectsPage, listScopeKey, publishedOnly]);

  useEffect(() => {
    if (!authReady) return;
    if (!authUserId) {
      router.replace(`/auth?redirect=${encodeURIComponent("/dashboard")}`);
    }
  }, [authReady, authUserId, router]);

  useEffect(() => {
    if (authUserId) void loadFolders();
  }, [authUserId, loadFolders]);

  useEffect(() => {
    if (!authReady || !authUserId) return;
    void loadInitialProjects(listScopeKey, publishedOnly);
  }, [authReady, authUserId, listScopeKey, publishedOnly, loadInitialProjects]);

  const hasGenerating = projects.some((p) => p.status === "generating");

  /**
   * 只要**当前已加载列表**里有一条 `generating`，就每 3s 刷新同一段数据，
   * 让卡片上的「生成中 → 就绪/失败」及时更新（无需手动刷新页面）。
   * 标签页在后台时不请求，回到前台时会立刻刷新一次。
   */
  useEffect(() => {
    if (!hasGenerating) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshLoadedProjects();
    };

    const interval = setInterval(tick, 3000);

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refreshLoadedProjects();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasGenerating, refreshLoadedProjects]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreProjects();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMoreProjects, loading, loadingMore]);

  // Step 1: click delete → show confirm modal
  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
  };

  // Step 2: confirm → show loading overlay, do the delete
  const handleConfirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const requestDissolveFolder = useCallback(async (id: string) => {
    setManageFoldersOpen(false);
    setPendingDeleteFolderId(id);
    setPendingDissolveCount(null);
    try {
      const res = await fetch(`/api/folders/${id}`);
      if (res.ok) {
        const body = (await res.json()) as { projectCount?: number };
        setPendingDissolveCount(
          typeof body.projectCount === "number" ? body.projectCount : 0
        );
      } else {
        setPendingDissolveCount(0);
      }
    } catch {
      setPendingDissolveCount(0);
    }
  }, []);

  const handleConfirmDeleteFolder = async () => {
    const id = pendingDeleteFolderId;
    if (!id) return;
    setPendingDeleteFolderId(null);
    setPendingDissolveCount(null);
    setManageFoldersOpen(false);
    setDeletingFolder(true);
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadFolders();
        notifyFoldersChanged();
        if (folderFilter === id) {
          applyFolderFilter("all");
        } else {
          await loadInitialProjects(listScopeKey, publishedOnly, { soft: true });
        }
      }
    } finally {
      setDeletingFolder(false);
    }
  };

  const handleMoveProject = useCallback(
    async (projectId: string, folderId: string | null) => {
      if (movingId) return;
      setMovingId(projectId);
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        if (res.ok) {
          if (publishedOnly) {
            setProjects((prev) =>
              prev.map((p) => (p.id === projectId ? { ...p, folderId } : p))
            );
          } else {
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
          }
        }
      } finally {
        setMovingId(null);
      }
    },
    [movingId, publishedOnly]
  );

  const focusCreatePrompt = useCallback(() => {
    const root = document.getElementById(WORKSPACE_PROMPT_ID);
    root?.scrollIntoView({ behavior: "smooth", block: "start" });
    const textarea = root?.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      window.setTimeout(() => textarea.focus(), 280);
    }
  }, []);

  const openProject = useCallback(
    (projectId: string) => {
      captureAppReturnTo();
      router.push(`/studio/${projectId}`);
    },
    [router]
  );

  const handlePublishChange = useCallback(
    (projectId: string, state: ProjectPublishState) => {
      setProjects((prev) => {
        if (publishedOnly && !state.publishPreview) {
          return prev.filter((p) => p.id !== projectId);
        }
        return prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                publishPreview: state.publishPreview,
                allowRemix: state.allowRemix,
                staticPreviewSyncedAt: state.staticPreviewSyncedAt,
              }
            : p
        );
      });
    },
    [publishedOnly]
  );

  const atRoot = !publishedOnly && isRootFolderParam(folderFilter);
  const currentFolderTitle = publishedOnly
    ? "已发布"
    : atRoot
      ? "我的项目"
      : folders.find((f) => f.id === folderFilter)?.name ?? "文件夹";
  const emptyTitle = publishedOnly
    ? "还没有已发布的项目"
    : atRoot
      ? "还没有项目"
      : "这个文件夹还是空的";
  const emptyHint = publishedOnly
    ? "在项目菜单里选择「发布到社区」后会出现在这里"
    : atRoot
      ? "描述你的想法，AI 帮你生成完整网站"
      : "在上方创建，或从其他位置移动项目到这里";

  if (!authReady || !authUser) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-foreground/65">加载…</p>
      </main>
    );
  }

  const greetName = (() => {
    const full = getUserDisplayName(authUser);
    const first = full.trim().split(/\s+/)[0] ?? full;
    return first || "朋友";
  })();

  return (
    <main className="relative min-h-screen">
      {pendingDeleteId && (
        <ConfirmDeleteModal
          projectName={projects.find((p) => p.id === pendingDeleteId)?.name || "未命名项目"}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {deletingId ? <DeletingOverlay label="正在删除项目..." /> : null}
      {deletingFolder ? <DeletingOverlay label="正在解散文件夹..." /> : null}

      {pendingDeleteFolderId && (
        <ConfirmDeleteFolderModal
          folderName={folders.find((f) => f.id === pendingDeleteFolderId)?.name ?? "文件夹"}
          projectCount={pendingDissolveCount}
          onConfirm={handleConfirmDeleteFolder}
          onCancel={() => {
            setPendingDeleteFolderId(null);
            setPendingDissolveCount(null);
          }}
        />
      )}

      {manageFoldersOpen && (
        <ManageFoldersModal
          folders={folders}
          onClose={() => setManageFoldersOpen(false)}
          onCreated={loadFolders}
          onRenamed={loadFolders}
          onRequestDissolve={(id) => void requestDissolveFolder(id)}
        />
      )}

      <div className="relative z-[1]  mx-auto min-h-screen px-8 py-8 sm:px-6 md:py-10 lg:px-8">
        <section
          id={WORKSPACE_PROMPT_ID}
          className="relative mb-12 scroll-mt-4 overflow-hidden rounded-[32px] border border-border bg-muted/30 px-4 py-12 sm:px-8 sm:py-16 md:py-20 dark:bg-transparent"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 ox-prompt-hero-glow" />
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground sm:text-[36px] md:text-[42px]">
              今天想构建什么，{greetName}？
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground sm:text-[15px]">
              描述你的想法，生成可运行的 website 站点
            </p>
          </div>
          <Suspense
            fallback={
              <div className="mx-auto h-40 w-full max-w-4xl animate-pulse rounded-2xl border border-border bg-card" />
            }
          >
            <HeroPrompt />
          </Suspense>
        </section>

        <div className="mb-8 px-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {currentFolderTitle}
          </h2>
          <button
            type="button"
            onClick={() => setManageFoldersOpen(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary sm:self-auto"
          >
            <FolderCog className="h-3.5 w-3.5" />
            管理文件夹
          </button>
        </div>

        {loading ? (
          <div
            className="grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
            aria-busy="true"
            aria-label="加载项目中"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 && !switchingFolder ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted/40">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
              <p className="text-sm text-foreground/65">{emptyHint}</p>
            </div>
            {publishedOnly ? (
              <button
                type="button"
                onClick={() => applyFolderFilter("all")}
                className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em]"
              >
                查看我的项目
              </button>
            ) : (
              <button
                type="button"
                onClick={focusCreatePrompt}
                className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em]"
              >
                <Plus className="h-4 w-4" />
                创建第一个项目
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-200",
                switchingFolder && "pointer-events-none opacity-45"
              )}
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => openProject(project.id)}
                  onDelete={() => handleDeleteClick(project.id)}
                  deleting={deletingId === project.id || movingId === project.id}
                  canDelete={
                    !!authUser?.id &&
                    (project.ownerUserId === authUser.id || isAdmin)
                  }
                  onPublishChange={handlePublishChange}
                  folders={folders}
                  onMove={(folderId) => void handleMoveProject(project.id, folderId)}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="flex min-h-14 items-center justify-center py-6">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs text-foreground/65 font-mono tracking-wider">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载更多项目...
                </div>
              ) : !hasMore ? (
                <span className="text-[11px] text-foreground/55 font-mono tracking-wider">已加载全部项目</span>
              ) : null}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </main>
  );
}
