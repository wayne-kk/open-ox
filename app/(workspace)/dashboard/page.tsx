"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trash2, Plus, FolderInput,
  AlertCircle, Loader2, Sparkles,
  AlertTriangle, MoreHorizontal, Globe2, FolderCog, Check, Pencil,
  Repeat2,
} from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { captureAppReturnTo } from "@/lib/navigation/appBack";
import { useAuthUser, useAuthProfile } from "@/app/components/AuthHeaderActions";
import {
  patchProjectPublish,
  type ProjectPublishState,
} from "@/app/components/ProjectPublishPanel";
import { fetchProjectGalleryDeduped } from "@/lib/projectGalleryClient";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
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
  verificationStatus?: "passed" | "failed";
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
    { bg: "from-orange-950/80 to-amber-950/60", text: "text-orange-300", accent: "bg-orange-500/20" },
    { bg: "from-blue-950/80 to-indigo-950/60", text: "text-blue-300", accent: "bg-blue-500/20" },
    { bg: "from-emerald-950/80 to-teal-950/60", text: "text-emerald-300", accent: "bg-emerald-500/20" },
    { bg: "from-purple-950/80 to-violet-950/60", text: "text-purple-300", accent: "bg-purple-500/20" },
    { bg: "from-rose-950/80 to-pink-950/60", text: "text-rose-300", accent: "bg-rose-500/20" },
    { bg: "from-cyan-950/80 to-sky-950/60", text: "text-cyan-300", accent: "bg-cyan-500/20" },
  ];
  return palettes[Math.abs(hash) % palettes.length];
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
  const hasCover = project.coverImageStatus === "ready";
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

  const statusBadge = publishPreview
    ? {
        icon: Globe2,
        label: "已发布",
        className: "border-primary/25 bg-primary/15 text-primary",
        spin: false,
      }
    : isGenerating
      ? {
          icon: Loader2,
          label: "生成中",
          className: "border-white/10 bg-black/55 text-primary",
          spin: true,
        }
      : isFailed
        ? {
            icon: AlertCircle,
            label: "失败",
            className: "border-red-400/30 bg-black/55 text-red-300",
            spin: false,
          }
        : null;
  const StatusIcon = statusBadge?.icon;

  const menuItemClass =
    "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-white/85 focus:bg-white/[0.06] focus:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white";

  return (
    <article
      className={cn(
        "group/card relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-white/[0.08] bg-[#0a0c10]",
        "transition-[border-color,transform,box-shadow] duration-200 ease-out",
        isClickable && "hover:-translate-y-0.5 hover:border-white/16 hover:shadow-[0_12px_40px_-18px_rgba(0,0,0,0.85)]",
        isFailed && "border-red-400/20 hover:border-red-400/35",
        isGenerating && "border-primary/20 hover:border-primary/35",
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
          "relative block w-full overflow-hidden text-left aspect-[1480/960]",
          !hasCover && `bg-gradient-to-br ${colors.bg}`,
          hasCover && "bg-[#05070b]",
          isClickable
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
            : "cursor-default"
        )}
      >
        {hasCover ? (
          /* eslint-disable-next-line @next/next/no-img-element -- versioned app cover proxy */
          <img
            src={projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt)}
            alt=""
            className="h-full w-full object-contain object-center transition-transform duration-500 ease-out group-hover/card:scale-[1.015]"
            loading="lazy"
            decoding="async"
          />
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
                "relative z-[1] flex h-full items-center justify-center font-heading text-3xl font-bold tracking-tight sm:text-4xl",
                colors.text,
                "opacity-80"
              )}
            >
              {initials || "?"}
            </span>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0c10]/90 to-transparent" />

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
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            disabled={!isClickable}
            onClick={openStudioOrPreview}
            onAuxClick={openPreviewTab}
            className={cn(
              "min-w-0 flex-1 text-left text-[14px] font-semibold leading-snug text-white/95 transition-colors line-clamp-2",
              isClickable
                ? "cursor-pointer hover:text-primary focus-visible:outline-none focus-visible:text-primary"
                : "cursor-default"
            )}
          >
            {project.name || "未命名项目"}
          </button>
          {canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded-lg p-1.5 text-white/40 opacity-70 transition-all hover:bg-white/[0.06] hover:text-white/85 group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white data-[state=open]:opacity-100"
                  title="更多"
                  aria-label="项目操作"
                >
                  {publishBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-52 rounded-xl border border-white/10 bg-[#0e1118]/98 p-1.5 text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl"
              >
                <DropdownMenuItem
                  disabled={publishBusy || (!hasStaticPreview && !publishPreview)}
                  className={menuItemClass}
                  onSelect={(e) => {
                    e.preventDefault();
                    void togglePublish(!publishPreview);
                  }}
                >
                  <Globe2 className="h-3.5 w-3.5 shrink-0 text-white/50" />
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
                  <Repeat2 className="h-3.5 w-3.5 shrink-0 text-white/50" />
                  {allowRemix ? "关闭 Remix" : "允许 Remix"}
                </DropdownMenuItem>
                {!hasStaticPreview && !publishPreview ? (
                  <p className="px-2.5 pb-1.5 pt-0.5 text-[10px] leading-relaxed text-white/40">
                    需先有静态预览才能发布
                  </p>
                ) : null}
                <DropdownMenuSeparator className="my-1.5 bg-white/[0.08]" />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    className={cn(menuItemClass, "focus:bg-white/[0.06] data-[state=open]:bg-white/[0.06]")}
                  >
                    <FolderInput className="h-3.5 w-3.5 shrink-0 text-white/50" />
                    移动到…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 w-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0e1118]/98 p-1.5 text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl">
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
                <DropdownMenuSeparator className="my-1.5 bg-white/[0.08]" />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={deleting}
                  className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] focus:bg-red-500/12 data-[highlighted]:bg-red-500/12"
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  删除项目
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {project.verificationStatus === "passed" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/45">
              已验证
            </span>
          </div>
        ) : null}

        {project.userPrompt?.trim() ? (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-white/55">
            {project.userPrompt.trim()}
          </p>
        ) : (
          <p className="text-[12px] text-white/30">暂无描述</p>
        )}

        {publishError ? (
          <p className="text-[10px] text-red-400/85">{publishError}</p>
        ) : null}

        <div className="mt-auto border-t border-white/[0.06] pt-2.5">
          <span className="text-[11px] tabular-nums text-white/40">
            {timeAgo(project.createdAt)}
          </span>
        </div>
      </div>
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
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0f14] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-white">解散文件夹</h3>
        </div>
        <p className="text-[13px] text-white/60 leading-relaxed mb-1">
          解散「<span className="text-white/90 font-medium">{folderName}</span>」？
        </p>
        <p className="text-[12px] text-white/50 mb-6">
          夹内 {countLabel} 个项目将回到最外层，项目本身不会被删除。
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-white/60 border border-white/10 hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-white bg-amber-500/80 hover:bg-amber-500 border border-amber-500/40 transition-colors"
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
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-white">管理文件夹</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white/80"
          >
            关闭
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] pl-3 pr-1.5 py-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新文件夹名称"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white/85 outline-none placeholder:text-white/30"
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
              <li className="py-6 text-center text-[12px] text-white/40">还没有文件夹</li>
            ) : (
              folders.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2"
                >
                  {editingId === f.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[13px] text-white outline-none focus:border-primary/40"
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
                        className="rounded-md px-2 py-1 text-[11px] text-white/45 hover:bg-white/5"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{f.name}</span>
                      <button
                        type="button"
                        title="重命名"
                        onClick={() => startRename(f)}
                        className="rounded-md p-1.5 text-white/35 hover:bg-white/5 hover:text-white/70"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="解散文件夹"
                        onClick={() => onRequestDissolve(f.id)}
                        className="rounded-md p-1.5 text-white/35 hover:bg-red-500/10 hover:text-red-400"
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
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0f14] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-white">确认删除</h3>
        </div>
        <p className="text-[13px] text-white/60 leading-relaxed mb-1">
          确定要删除项目 <span className="text-white/90 font-medium">&ldquo;{projectName}&rdquo;</span> 吗？
        </p>
        <p className="text-[12px] text-red-400/60 mb-6">此操作不可撤销，项目所有数据将被永久删除。</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-white/60 border border-white/10 hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-white bg-red-500/80 hover:bg-red-500 border border-red-500/40 transition-colors"
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
        <p className="font-mono text-sm text-white/60 tracking-wider">{label}</p>
        <p className="font-mono text-[10px] text-white/55">请勿关闭页面</p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen  flex items-center justify-center">
          <p className="font-mono text-sm text-white/65">加载…</p>
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
    const f = searchParams.get("folder");
    const next = isRootFolderParam(f) ? "all" : f!;
    setFolderFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const folderQuery = isRootFolderParam(folderFilter) ? "all" : folderFilter;
  const authUserId = authUser?.id ?? null;

  type GalleryPagePayload = {
    projects: ProjectMetadata[];
  };

  const fetchProjectsPage = useCallback(
    async (offset: number, limit: number, folder: string): Promise<GalleryPagePayload | null> => {
      try {
        const params = new URLSearchParams();
        params.set("offset", String(offset));
        params.set("limit", String(limit));
        params.set("mine", "1");
        params.set("folder", folder);
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
    async (folder: string, opts?: { soft?: boolean }) => {
      const requestKey = `${folder}|0|${PAGE_SIZE}`;
      galleryRequestKeyRef.current = requestKey;
      const soft = opts?.soft ?? loadedFolderRef.current !== null;
      if (soft) setSwitchingFolder(true);
      else setLoading(true);

      const payload = await fetchProjectsPage(0, PAGE_SIZE, folder);
      if (galleryRequestKeyRef.current !== requestKey) return;
      if (payload) {
        setProjects(payload.projects);
        setHasMore(payload.projects.length === PAGE_SIZE);
        loadedFolderRef.current = folder;
      }
      setLoading(false);
      setSwitchingFolder(false);
    },
    [fetchProjectsPage]
  );

  const loadMoreProjects = useCallback(async () => {
    if (loading || switchingFolder || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const payload = await fetchProjectsPage(projects.length, PAGE_SIZE, folderQuery);
    if (payload) {
      setProjects((prev) => [...prev, ...payload.projects]);
      setHasMore(payload.projects.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [
    fetchProjectsPage,
    folderQuery,
    hasMore,
    loading,
    loadingMore,
    projects.length,
    switchingFolder,
  ]);

  const refreshLoadedProjects = useCallback(async () => {
    const loadedCount = projectsRef.current.length;
    if (loadedCount === 0) return;
    const folder = loadedFolderRef.current ?? folderQuery;
    const payload = await fetchProjectsPage(0, loadedCount, folder);
    if (payload) {
      setProjects(payload.projects);
      setHasMore(payload.projects.length === loadedCount);
    }
  }, [fetchProjectsPage, folderQuery]);

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
    void loadInitialProjects(folderQuery);
  }, [authReady, authUserId, folderQuery, loadInitialProjects]);

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
          await loadInitialProjects(folderQuery, { soft: true });
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
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        }
      } finally {
        setMovingId(null);
      }
    },
    [movingId]
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

  const handlePublishChange = useCallback((projectId: string, state: ProjectPublishState) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              publishPreview: state.publishPreview,
              allowRemix: state.allowRemix,
              staticPreviewSyncedAt: state.staticPreviewSyncedAt,
            }
          : p
      )
    );
  }, []);

  const atRoot = isRootFolderParam(folderFilter);
  const currentFolderTitle = atRoot
    ? "我的项目"
    : folders.find((f) => f.id === folderFilter)?.name ?? "文件夹";
  const emptyTitle = atRoot ? "还没有项目" : "这个文件夹还是空的";
  const emptyHint = atRoot
    ? "描述你的想法，AI 帮你生成完整网站"
    : "在上方创建，或从其他位置移动项目到这里";

  if (!authReady || !authUser) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-white/65">加载…</p>
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

      <div className="relative z-[1] container mx-auto min-h-screen px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        <section
          id={WORKSPACE_PROMPT_ID}
          className="relative mb-12 scroll-mt-4 overflow-hidden rounded-[32px] border border-white/[0.06] px-4 py-12 sm:px-8 sm:py-16 md:py-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,255,136,0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 20% 80%, rgba(255,0,170,0.12), transparent 50%), radial-gradient(ellipse 60% 45% at 85% 70%, rgba(0,200,255,0.12), transparent 50%), linear-gradient(180deg, rgba(8,10,14,0.2) 0%, rgba(3,4,6,0.85) 100%)",
            }}
          />
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-white sm:text-[36px] md:text-[42px]">
              今天想构建什么，{greetName}？
            </h1>
            <p className="mt-3 text-[14px] text-white/55 sm:text-[15px]">
              描述你的想法，生成可运行的 Next.js 站点
            </p>
          </div>
          <Suspense
            fallback={
              <div className="mx-auto h-48 max-w-3xl animate-pulse rounded-[28px] border border-white/10 bg-white/[0.03]" />
            }
          >
            <HeroPrompt variant="workspace" />
          </Suspense>
        </section>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-white sm:text-xl">
            {currentFolderTitle}
          </h2>
          <button
            type="button"
            onClick={() => setManageFoldersOpen(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary sm:self-auto"
          >
            <FolderCog className="h-3.5 w-3.5" />
            管理文件夹
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 min-h-screen">
            <HamsterLoader size="sm" className="-mt-[200px]" />
            <p className="font-mono text-xs text-white/65 tracking-wider">加载中...</p>
          </div>
        ) : projects.length === 0 && !switchingFolder ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02]">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-white">{emptyTitle}</h2>
              <p className="text-sm text-white/65">{emptyHint}</p>
            </div>
            <button
              type="button"
              onClick={focusCreatePrompt}
              className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em]"
            >
              <Plus className="h-4 w-4" />
              创建第一个项目
            </button>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "grid items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 transition-opacity duration-200",
                switchingFolder && "pointer-events-none opacity-45"
              )}
            >
              <button
                type="button"
                onClick={focusCreatePrompt}
                className="group flex min-h-[180px] w-full flex-col items-center justify-center gap-3 self-stretch rounded-2xl border border-dashed border-white/[0.12]
                  bg-[#0a0c10]/60 p-6
                  transition-[border-color,background-color,transform] duration-200 ease-out
                  hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.04]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
                  <Plus className="h-5 w-5 text-white/45 transition-colors group-hover:text-primary" />
                </div>
                <span className="text-[12px] font-medium text-white/50 transition-colors group-hover:text-primary/80">
                  新建项目
                </span>
              </button>

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
                <div className="flex items-center gap-2 text-xs text-white/65 font-mono tracking-wider">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载更多项目...
                </div>
              ) : !hasMore ? (
                <span className="text-[11px] text-white/55 font-mono tracking-wider">已加载全部项目</span>
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
