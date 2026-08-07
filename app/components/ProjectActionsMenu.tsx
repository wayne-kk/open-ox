"use client";

import { useState } from "react";
import {
  Check,
  FolderInput,
  Globe2,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Repeat2,
  Rocket,
  Tag,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  patchProjectPublish,
  type ProjectPublishState,
} from "@/app/components/ProjectPublishPanel";
import {
  COVER_CAPTURE_POLL_INTERVAL_MS,
  COVER_CAPTURE_POLL_TIMEOUT_MS,
  evaluateCoverCapturePoll,
} from "@/lib/coverCaptureOrchestration";
import { openOxVercelReconnectHref } from "@/lib/vercel/dashboardUrl";
import { cn } from "@/lib/utils";
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

export type ProjectActionsTag = {
  id: string;
  name: string;
};

export type ProjectActionsFolder = {
  id: string;
  name: string;
};

export type ProjectActionsTarget = {
  id: string;
  name: string;
  status: "awaiting_input" | "generating" | "ready" | "failed";
  folderId?: string | null;
  publishPreview?: boolean;
  allowRemix?: boolean;
  staticPreviewSyncedAt?: string | null;
  coverImageStatus?: "pending" | "ready" | "failed" | null;
  coverImageUpdatedAt?: string | null;
  tags?: ProjectActionsTag[];
};

const menuItemClass =
  "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground/90 outline-none focus:bg-muted focus:!text-foreground focus:!**:text-foreground data-[highlighted]:bg-muted data-[highlighted]:!text-foreground data-[highlighted]:!**:text-foreground";

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

function ConfirmTrashModal({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: (autoPurge: boolean) => void;
  onCancel: () => void;
}) {
  const [autoPurge, setAutoPurge] = useState(true);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">移到回收站</h3>
        </div>
        <p className="mb-1 text-[13px] leading-relaxed text-muted-foreground">
          确定将项目 <span className="font-medium text-foreground/90">&ldquo;{projectName}&rdquo;</span>{" "}
          移到回收站吗？
        </p>
        <p className="mb-4 text-[12px] text-muted-foreground/80">
          可从回收站恢复。若已发布到社区，将立即取消发布。
        </p>
        <label className="mb-6 flex cursor-pointer select-none items-start gap-2.5">
          <input
            type="checkbox"
            checked={autoPurge}
            onChange={(e) => setAutoPurge(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-red-500"
          />
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            30 天后自动永久删除
          </span>
        </label>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(autoPurge)}
            className="rounded-xl border border-red-500/40 bg-red-500/80 px-4 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-red-500"
          >
            移到回收站
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectActionsMenu({
  project,
  folders,
  allTags,
  triggerClassName,
  align = "end",
  side = "right",
  onPublishChange,
  onMove,
  onTagsChange,
  onCoverChange,
  onConfirmTrash,
  deleting = false,
}: {
  project: ProjectActionsTarget;
  folders: ProjectActionsFolder[];
  allTags: ProjectActionsTag[];
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  onPublishChange: (projectId: string, state: ProjectPublishState) => void;
  onMove: (folderId: string | null) => void;
  onTagsChange: (projectId: string, tags: ProjectActionsTag[]) => void;
  onCoverChange?: (
    projectId: string,
    cover: { status: "ready"; updatedAt: string }
  ) => void;
  onConfirmTrash: (autoPurge: boolean) => void | Promise<void>;
  deleting?: boolean;
}) {
  const isReady = project.status === "ready";
  const isFailed = project.status === "failed";
  const isGenerating = project.status === "generating";
  const isClickable = isReady || isFailed || isGenerating;

  const publishPreview = project.publishPreview === true;
  const allowRemix = project.allowRemix === true;
  const hasStaticPreview =
    typeof project.staticPreviewSyncedAt === "string" &&
    project.staticPreviewSyncedAt.trim().length > 0;

  const [publishBusy, setPublishBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [deployConfirmOpen, setDeployConfirmOpen] = useState(false);
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const [deployBusy, setDeployBusy] = useState(false);

  const projectTags = project.tags ?? [];
  const projectTagIds = new Set(projectTags.map((t) => t.id));

  const togglePublish = async (next: boolean) => {
    if (publishBusy) return;
    setPublishBusy(true);
    const result = await patchProjectPublish(project.id, { publishPreview: next });
    setPublishBusy(false);
    if (!result.ok) {
      toast.error(
        result.code === "STATIC_PREVIEW_REQUIRED"
          ? "需要先有静态预览"
          : result.error || "发布设置失败"
      );
      return;
    }
    onPublishChange(project.id, result.state);
  };

  const toggleRemix = async (next: boolean) => {
    if (publishBusy || !publishPreview) return;
    setPublishBusy(true);
    const result = await patchProjectPublish(project.id, { allowRemix: next });
    setPublishBusy(false);
    if (!result.ok) {
      toast.error(result.error || "Remix 设置失败");
      return;
    }
    onPublishChange(project.id, result.state);
  };

  const applyTagIds = async (nextIds: string[]) => {
    if (tagBusy) return;
    setTagBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: nextIds }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "更新标签失败");
        return;
      }
      onTagsChange(project.id, (await res.json()) as ProjectActionsTag[]);
    } catch {
      toast.error("更新标签失败");
    } finally {
      setTagBusy(false);
    }
  };

  const toggleTag = (tagId: string) => {
    const next = new Set(projectTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    void applyTagIds([...next]);
  };

  const createAndAddTag = async () => {
    const name = newTagName.trim();
    if (!name || tagBusy) return;
    setTagBusy(true);
    try {
      let tag: ProjectActionsTag | null = null;
      const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        tag = existing;
      } else {
        const createRes = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!createRes.ok) {
          const body = (await createRes.json().catch(() => ({}))) as { error?: string };
          toast.error(body.error || "创建标签失败");
          return;
        }
        tag = (await createRes.json()) as ProjectActionsTag;
      }
      if (!tag) return;
      setNewTagName("");
      const nextIds = projectTagIds.has(tag.id)
        ? [...projectTagIds]
        : [...projectTagIds, tag.id];
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: nextIds }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "更新标签失败");
        return;
      }
      onTagsChange(project.id, (await res.json()) as ProjectActionsTag[]);
    } catch {
      toast.error("创建标签失败");
    } finally {
      setTagBusy(false);
    }
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
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/cover/capture`,
        { method: "POST", credentials: "include" }
      );
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
          const updatedAt = body.coverImageUpdatedAt ?? new Date().toISOString();
          onCoverChange?.(project.id, { status: "ready", updatedAt });
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

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 data-[state=open]:bg-muted data-[state=open]:text-foreground data-[state=open]:opacity-100",
              triggerClassName
            )}
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
          align={align}
          side={side}
          sideOffset={8}
          className="z-[70] w-56 overflow-visible rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--box-shadow-neon-lg)] ring-0"
          onClick={(e) => e.stopPropagation()}
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
            <DropdownMenuSubContent className="z-[70] max-h-64 w-48 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--box-shadow-neon-lg)] ring-0">
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                menuItemClass,
                "bg-transparent focus:bg-muted data-[state=open]:bg-muted data-[state=open]:!text-foreground data-[state=open]:!**:text-foreground data-open:bg-muted data-open:!text-foreground data-open:!**:text-foreground"
              )}
            >
              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 whitespace-nowrap text-left">标签</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="z-[70] max-h-72 w-56 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--box-shadow-neon-lg)] ring-0">
              {allTags.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  还没有标签，在下方新建
                </p>
              ) : (
                allTags.map((t) => {
                  const current = projectTagIds.has(t.id);
                  return (
                    <DropdownMenuItem
                      key={t.id}
                      disabled={tagBusy}
                      className={menuItemClass}
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleTag(t.id);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      {current ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })
              )}
              <DropdownMenuSeparator className="mx-0 my-1 bg-muted" />
              <div
                className="flex items-center gap-1 px-1.5 py-1"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (e.target instanceof HTMLInputElement) {
                    e.target.focus();
                  }
                }}
              >
                <input
                  type="text"
                  value={newTagName}
                  maxLength={32}
                  placeholder="新建标签"
                  disabled={tagBusy}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createAndAddTag();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
                <button
                  type="button"
                  disabled={tagBusy || !newTagName.trim()}
                  onClick={() => void createAndAddTag()}
                  className="shrink-0 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary disabled:opacity-40"
                >
                  {tagBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "添加"
                  )}
                </button>
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="mx-0 my-1 bg-muted" />
          <DropdownMenuItem
            variant="destructive"
            disabled={deleting}
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-red-400 focus:bg-red-500/12 focus:!text-red-400 focus:!**:text-red-400 data-[highlighted]:bg-red-500/12 data-[highlighted]:!text-red-400 data-[highlighted]:!**:text-red-400"
            onSelect={() => setTrashConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            移到回收站
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {deployConfirmOpen ? (
        <ConfirmDeployModal
          projectName={project.name || "未命名项目"}
          busy={deployBusy}
          onConfirm={() => void runDeploy()}
          onCancel={() => {
            if (!deployBusy) setDeployConfirmOpen(false);
          }}
        />
      ) : null}

      {trashConfirmOpen ? (
        <ConfirmTrashModal
          projectName={project.name || "未命名项目"}
          onCancel={() => setTrashConfirmOpen(false)}
          onConfirm={(autoPurge) => {
            setTrashConfirmOpen(false);
            void onConfirmTrash(autoPurge);
          }}
        />
      ) : null}
    </>
  );
}
