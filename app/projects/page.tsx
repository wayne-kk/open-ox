"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trash2, Plus, Clock, Layers, Pencil,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Globe,
  AlertTriangle, FolderInput, Search, Users,
} from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthUser } from "@/app/components/AuthHeaderActions";
import { cn } from "@/lib/utils";

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
}

interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

const ownerFilterTriggerClass =
  "group flex h-9 w-full min-w-0 items-center justify-between gap-0 rounded-lg border border-white/12 " +
  "bg-white/[0.04] px-2.5 text-left text-[12px] font-medium text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "outline-none transition-colors hover:border-white/18 hover:bg-white/[0.07] " +
  "focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/25 " +
  "!h-9 data-[size=default]:h-9 data-placeholder:text-white/45 " +
  "[&>svg:last-child]:shrink-0 [&>svg:last-child]:text-white/55 group-hover:[&>svg:last-child]:text-white/70";

const ownerFilterContentClass =
  "z-[100] overflow-hidden rounded-xl border border-white/12 bg-[#141820] p-1.5 text-white " +
  "shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] " +
  "w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width) max-w-(--radix-select-trigger-width)";

const ownerFilterItemClass =
  "cursor-pointer rounded-lg py-2 pl-2.5 pr-8 text-[13px] leading-snug text-white/90 " +
  "focus:bg-white/[0.08] focus:text-white [&_svg]:text-primary/85";

function OwnerMemberSelect({
  id,
  value,
  onValueChange,
  ownerSelectOptions,
  widthClass = "w-[150px] min-w-[150px] max-w-[150px]",
  leadingIcon = true,
}: {
  id: string;
  value: string;
  onValueChange: (next: string) => void;
  ownerSelectOptions: { id: string; label: string }[];
  widthClass?: string;
  leadingIcon?: boolean;
}) {
  return (
    <div className={cn("min-w-0", widthClass)}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={ownerFilterTriggerClass}>
          <span className="flex min-w-0 flex-1 items-center gap-2 pr-1">
            {leadingIcon && (
              <Users className="size-4 shrink-0 text-white/40" aria-hidden />
            )}
            <SelectValue
              placeholder="选择成员"
              className="min-w-0 flex-1 truncate text-left"
            />
          </span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={6}
          align="start"
          alignOffset={0}
          className={ownerFilterContentClass}
        >
          <SelectItem value="all" className={ownerFilterItemClass}>
            全部成员
          </SelectItem>
          {ownerSelectOptions.map(({ id: oid, label }) => (
            <SelectItem key={oid} value={oid} className={ownerFilterItemClass}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const mineOnlyButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/12 " +
  "bg-white/[0.04] px-3 text-[12px] font-medium text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-primary";

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
  project, onDelete, onClick, deleting, canDelete, showOwner,
}: {
  project: ProjectMetadata;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
  deleting: boolean;
  canDelete: boolean;
  showOwner: boolean;
}) {
  const isReady = project.status === "ready";
  const isFailed = project.status === "failed";
  const isGenerating = project.status === "generating";
  const isClickable = isReady || isFailed;
  const colors = hashColor(project.id);
  const initials = (project.name || "P")
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const pressedRef = useRef(false);
  const [pressed, setPressed] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore right-click and let delete button handle its own clicks
    if (e.button !== 0 || !isClickable) return;
    pressedRef.current = true;
    setPressed(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!pressedRef.current || !isClickable) return;
    pressedRef.current = false;
    setPressed(false);
    // Only navigate if mouse is still over this card (not the delete button)
    const target = e.target as HTMLElement;
    if (!target.closest("[data-delete-btn]")) {
      if (e.metaKey || e.ctrlKey) {
        window.open(`/studio/${project.id}`, "_blank");
      } else {
        onClick();
      }
    }
  };

  const handleMouseLeave = () => {
    pressedRef.current = false;
    setPressed(false);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        group relative rounded-2xl border overflow-hidden transition-all duration-300${pressed ? " select-none" : ""}
        ${isReady
          ? `border-white/10 hover:border-primary/40 cursor-pointer hover:shadow-[0_0_50px_-12px_rgba(247,147,26,0.25)] ${pressed ? "scale-[0.98]" : "hover:-translate-y-1"}`
          : isFailed
            ? `border-red-400/20 hover:border-red-400/40 cursor-pointer hover:shadow-[0_0_30px_-12px_rgba(248,113,113,0.2)] ${pressed ? "scale-[0.98]" : "hover:-translate-y-1"}`
            : isGenerating
              ? "border-primary/20 cursor-default"
              : "border-white/8 cursor-default"
        }
      `}
    >
      {/* Cover image area — text-based */}
      <div className={`relative h-32 bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />

        {/* Large initials */}
        <span className={`relative font-heading text-4xl font-bold ${colors.text} opacity-80`}>
          {initials || "?"}
        </span>

        {/* Status overlay */}
        <div className="absolute top-3 right-3">
          {isGenerating ? (
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[9px] font-mono font-bold text-primary tracking-wider">生成中</span>
            </div>
          ) : project.status === "failed" ? (
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <span className="text-[9px] font-mono font-bold text-red-400 tracking-wider">失败</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1">
              <CheckCircle2 className="h-3 w-3 text-green-400" />
              <span className="text-[9px] font-mono font-bold text-green-400 tracking-wider">就绪</span>
            </div>
          )}
        </div>

        {/* Globe icon */}
        <Globe className="absolute bottom-3 left-3 h-4 w-4 text-white/10" />

        {/* Generating shimmer */}
        {isGenerating && (
          <div className="absolute inset-0 animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        )}
      </div>

      {/* Content */}
      <div className="bg-[#0b0d12] p-4">
        <h3 className="font-heading text-[15px] font-semibold text-white truncate group-hover:text-primary transition-colors">
          {project.name || "未命名项目"}
        </h3>
        {showOwner && (project.ownerUsername || project.ownerUserId) && (
          <p className="mt-1 text-[10px] font-mono text-primary/70 truncate">
            {project.ownerUsername?.trim() || project.ownerUserId?.slice(0, 8)}
          </p>
        )}
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/50 line-clamp-2 min-h-[40px]">
          {project.userPrompt}
        </p>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-mono text-white/30">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(project.createdAt)}
            </span>
            {project.modificationHistory.length > 0 && (
              <span className="flex items-center gap-1">
                <Pencil className="h-3 w-3" />
                {project.modificationHistory.length}
              </span>
            )}
            {project.verificationStatus === "passed" && (
              <span className="flex items-center gap-1 text-green-400/40">
                <Layers className="h-3 w-3" />
                已验证
              </span>
            )}
          </div>

          {canDelete ? (
            <button
              data-delete-btn
              onClick={onDelete}
              disabled={deleting}
              className="rounded-lg p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10
                transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="删除项目"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-7" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ── */
function ConfirmDeleteFolderModal({
  folderName,
  onConfirm,
  onCancel,
}: {
  folderName: string;
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
          <h3 className="text-[15px] font-semibold text-white">删除文件夹</h3>
        </div>
        <p className="text-[13px] text-white/60 leading-relaxed mb-1">
          确定删除文件夹 <span className="text-white/90 font-medium">&ldquo;{folderName}&rdquo;</span> 吗？
        </p>
        <p className="text-[12px] text-red-400/80 mb-6">
          该文件夹内的所有项目将一并永久删除，不可恢复。
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
            className="rounded-xl px-4 py-2 text-[12px] font-medium text-white bg-red-500/80 hover:bg-red-500 border border-red-500/40 transition-colors"
          >
            确认删除
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
function DeletingOverlay() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <HamsterLoader size="sm" />
        <p className="font-mono text-sm text-white/60 tracking-wider">正在删除项目...</p>
        <p className="font-mono text-[10px] text-white/30">请勿关闭页面</p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen pt-[57px] flex items-center justify-center">
          <p className="font-mono text-sm text-white/40">加载…</p>
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
  const { user: authUser } = useAuthUser();
  const folderParamForView = (searchParams.get("folder") || "all").trim() || "all";
  const isMineView =
    searchParams.get("mine") === "1" ||
    folderParamForView === "uncategorized" ||
    (folderParamForView !== "all" && folderParamForView.length > 0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  const applyFolderFilter = useCallback(
    (next: string) => {
      setFolderFilter(next);
      const path =
        next === "all"
          ? "/projects?mine=1&folder=all"
          : `/projects?mine=1&folder=${encodeURIComponent(next)}`;
      router.replace(path, { scroll: false });
    },
    [router]
  );

  const handleOwnerFilterChange = useCallback(
    (v: string) => {
      setListSearch("");
      if (v === "all") router.replace("/projects", { scroll: false });
      else router.replace(`/projects?owner=${encodeURIComponent(v)}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const f = searchParams.get("folder");
    if (f === "uncategorized") setFolderFilter("uncategorized");
    else if (!f || f === "all") setFolderFilter("all");
    else setFolderFilter(f);
  }, [searchParams]);

  const folderQuery =
    folderFilter === "all"
      ? "all"
      : folderFilter === "uncategorized"
        ? "uncategorized"
        : folderFilter;

  /** 全员视图下按 URL ?owner=uuid 服务端筛选某位成员的项目 */
  const globalOwnerParam = useMemo(() => {
    if (isMineView) return null;
    const o = searchParams.get("owner");
    return o && /^[0-9a-f-]{36}$/i.test(o) ? o : null;
  }, [isMineView, searchParams]);

  const [listSearch, setListSearch] = useState("");

  const fetchProjectsPage = useCallback(
    async (offset: number, limit: number) => {
      try {
        const params = new URLSearchParams();
        params.set("offset", String(offset));
        params.set("limit", String(limit));
        if (isMineView) {
          params.set("mine", "1");
          params.set("folder", folderQuery);
        } else if (globalOwnerParam) {
          params.set("owner", globalOwnerParam);
        }
        const res = await fetch(`/api/projects?${params.toString()}`);
        if (res.status === 401) {
          router.push(`/auth?redirect=${encodeURIComponent("/projects")}`);
          return null;
        }
        if (!res.ok) return null;
        return (await res.json()) as ProjectMetadata[];
      } catch {
        return null;
      }
    },
    [folderQuery, globalOwnerParam, isMineView, router]
  );

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      setFolders((await res.json()) as ProjectFolder[]);
    }
  }, []);

  const loadInitialProjects = useCallback(async () => {
    setLoading(true);
    const data = await fetchProjectsPage(0, PAGE_SIZE);
    if (data) {
      setProjects(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [fetchProjectsPage]);

  const loadMoreProjects = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await fetchProjectsPage(projects.length, PAGE_SIZE);
    if (data) {
      setProjects((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [fetchProjectsPage, hasMore, loading, loadingMore, projects.length]);

  const refreshLoadedProjects = useCallback(async () => {
    const loadedCount = projects.length;
    if (loadedCount === 0) return;
    const data = await fetchProjectsPage(0, loadedCount);
    if (data) {
      setProjects(data);
      setHasMore(data.length === loadedCount);
    }
  }, [fetchProjectsPage, projects.length]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadInitialProjects();
  }, [folderFilter, globalOwnerParam, isMineView, loadInitialProjects]);

  /** 下拉中的成员选项（来自已加载列表；URL 中的 owner 若不在列表也会补一条） */
  const ownerSelectOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      if (p.ownerUserId) {
        const label = p.ownerUsername?.trim() || `${p.ownerUserId.slice(0, 8)}…`;
        m.set(p.ownerUserId, label);
      }
    }
    const rows = [...m.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    if (globalOwnerParam && !m.has(globalOwnerParam)) {
      rows.push({ id: globalOwnerParam, label: `${globalOwnerParam.slice(0, 8)}…` });
      rows.sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    }
    return rows;
  }, [projects, globalOwnerParam]);

  /** 全员视图：在当前结果中按关键词筛选（名称、描述、成员） */
  const filteredGlobalProjects = useMemo(() => {
    if (isMineView) return projects;
    const q = listSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.userPrompt || "").toLowerCase().includes(q) ||
        (p.ownerUsername || "").toLowerCase().includes(q) ||
        (p.ownerUserId || "").toLowerCase().includes(q)
      );
    });
  }, [projects, listSearch, isMineView]);

  useEffect(() => {
    if (!projects.some((p) => p.status === "generating")) return;
    const interval = setInterval(refreshLoadedProjects, 3000);
    return () => clearInterval(interval);
  }, [projects, refreshLoadedProjects]);

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
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewFolderName("");
        await loadFolders();
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    const id = pendingDeleteFolderId;
    if (!id) return;
    setPendingDeleteFolderId(null);
    setDeletingFolder(true);
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (folderFilter === id) applyFolderFilter("all");
        await loadFolders();
        await loadInitialProjects();
      }
    } finally {
      setDeletingFolder(false);
    }
  };

  const newProjectHref =
    isMineView && folderFilter !== "all" && folderFilter !== "uncategorized"
      ? `/?folder=${folderFilter}`
      : "/";

  const goGlobalGallery = () => {
    setListSearch("");
    router.replace("/projects", { scroll: false });
  };

  const goMineProjects = () => {
    setListSearch("");
    router.replace("/projects?mine=1&folder=all", { scroll: false });
  };

  return (
    <main className="relative min-h-screen pt-[57px]">

      {/* Confirm delete modal */}
      {pendingDeleteId && (
        <ConfirmDeleteModal
          projectName={projects.find((p) => p.id === pendingDeleteId)?.name || "未命名项目"}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {/* Full-page loading overlay while deleting */}
      {(deletingId || deletingFolder) && <DeletingOverlay />}

      {pendingDeleteFolderId && (
        <ConfirmDeleteFolderModal
          folderName={folders.find((f) => f.id === pendingDeleteFolderId)?.name ?? "文件夹"}
          onConfirm={handleConfirmDeleteFolder}
          onCancel={() => setPendingDeleteFolderId(null)}
        />
      )}

      <div className="relative z-1 mx-auto max-w-6xl px-6 py-8 lg:px-8 min-h-screen">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-white/35 uppercase tracking-wider mr-1">视图</span>
            <button
              type="button"
              onClick={goGlobalGallery}
              className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors ${
                !isMineView
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 text-white/50 hover:border-white/20"
              }`}
            >
              全部成员
            </button>
            <button
              type="button"
              onClick={goMineProjects}
              className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors ${
                isMineView
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 text-white/50 hover:border-white/20"
              }`}
            >
              我的项目
            </button>
          </div>
        </div>

        {isMineView && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-white/35 uppercase tracking-wider mr-2">文件夹</span>
              <button
                type="button"
                onClick={() => applyFolderFilter("all")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors ${
                  folderFilter === "all"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => applyFolderFilter("uncategorized")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors ${
                  folderFilter === "uncategorized"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                未分类
              </button>
              {folders.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyFolderFilter(f.id)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium border transition-colors ${
                      folderFilter === f.id
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    title="删除文件夹"
                    onClick={() => setPendingDeleteFolderId(f.id)}
                    className="rounded p-0.5 text-white/20 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] pl-2 pr-1 py-1">
                <FolderInput className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="新文件夹名称"
                  className="w-32 sm:w-40 bg-transparent text-[12px] text-white/80 outline-none placeholder:text-white/25"
                  onKeyDown={(e) => e.key === "Enter" && void handleCreateFolder()}
                />
                <button
                  type="button"
                  disabled={creatingFolder || !newFolderName.trim()}
                  onClick={() => void handleCreateFolder()}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium bg-primary/20 text-primary disabled:opacity-30"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mb-6 text-[12px] text-white/35">
          {isMineView ? (
            <>
              提示：未归入任何文件夹的项目请点选「未分类」；也可直接打开{" "}
              <Link href="/projects?mine=1&folder=uncategorized" className="text-primary/80 hover:underline">
                /projects?mine=1&amp;folder=uncategorized
              </Link>
              。
            </>
          ) : (
            <>
              全员项目按时间排序（最新在前）。可用搜索在当前已加载结果中过滤；选择成员则只向服务器请求该成员的项目并支持翻页加载。
            </>
          )}
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 min-h-screen">
            <HamsterLoader size="sm" className="-mt-[200px]" />
            <p className="font-mono text-xs text-white/40 tracking-wider">加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            {!isMineView && globalOwnerParam && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label htmlFor="projects-owner-filter-empty" className="sr-only">
                  按成员筛选
                </label>
                <OwnerMemberSelect
                  id="projects-owner-filter-empty"
                  value={globalOwnerParam ?? "all"}
                  onValueChange={handleOwnerFilterChange}
                  ownerSelectOptions={ownerSelectOptions}
                  widthClass="w-[150px] min-w-[150px] max-w-[150px]"
                />
                {authUser && (
                  <button
                    type="button"
                    onClick={() => goMineProjects()}
                    className={mineOnlyButtonClass}
                  >
                    只看我的
                  </button>
                )}
              </div>
            )}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02]">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-white">
                {!isMineView && globalOwnerParam ? "该成员暂无项目" : "还没有项目"}
              </h2>
              <p className="text-sm text-white/40">
                {!isMineView && globalOwnerParam
                  ? "尝试查看全部成员，或选择其他成员。"
                  : "描述你的想法，AI 帮你生成完整网站"}
              </p>
            </div>
            {!isMineView && globalOwnerParam ? (
              <button
                type="button"
                onClick={() => goGlobalGallery()}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:border-primary/35 hover:text-primary"
              >
                查看全部成员
              </button>
            ) : (
              <Link href="/" className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em]">
                <Plus className="h-4 w-4" />
                创建第一个项目
              </Link>
            )}
          </div>
        ) : !isMineView ? (
          <>
            {!loading && (projects.length > 0 || globalOwnerParam) && (
              <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="relative min-w-0 flex-1 max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" aria-hidden />
                  <input
                    type="search"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="搜索项目名称、描述或成员…"
                    className="w-full rounded-lg border border-white/10 bg-[#0a0c10] py-2.5 pl-10 pr-3 text-[13px] text-white/90 placeholder:text-white/28 outline-none focus:border-primary/40"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <label htmlFor="projects-owner-filter" className="sr-only">
                    按成员筛选
                  </label>
                  <OwnerMemberSelect
                    id="projects-owner-filter"
                    value={globalOwnerParam ?? "all"}
                    onValueChange={handleOwnerFilterChange}
                    ownerSelectOptions={ownerSelectOptions}
                  />
                  {authUser && (
                    <button
                      type="button"
                      onClick={() => goMineProjects()}
                      className={mineOnlyButtonClass}
                    >
                      只看我的
                    </button>
                  )}
                </div>
              </div>
            )}

            {listSearch.trim() && projects.length > 0 && (
              <p className="mb-3 text-[11px] font-mono text-white/35">
                匹配 {filteredGlobalProjects.length} / {projects.length} 条（在当前已加载数据中）
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href={newProjectHref}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10
                  bg-white/[0.01] p-8 transition-all hover:border-primary/30 hover:bg-primary/[0.03] group min-h-[260px]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
                  <Plus className="h-6 w-6 text-white/30 group-hover:text-primary transition-colors" />
                </div>
                <span className="font-mono text-[11px] text-white/30 group-hover:text-primary/70 tracking-wider transition-colors">
                  新建项目
                </span>
              </Link>

              {filteredGlobalProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/studio/${project.id}`)}
                  onDelete={(e) => handleDeleteClick(e, project.id)}
                  deleting={deletingId === project.id}
                  canDelete={!!authUser?.id && project.ownerUserId === authUser.id}
                  showOwner
                />
              ))}
            </div>

            {!loading && filteredGlobalProjects.length === 0 && projects.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-6 py-12 text-center">
                <p className="text-[14px] text-white/50">没有匹配当前搜索的项目。</p>
                <button
                  type="button"
                  onClick={() => setListSearch("")}
                  className="mt-3 text-[13px] font-medium text-primary hover:underline"
                >
                  清除搜索
                </button>
              </div>
            )}

            <div ref={loadMoreRef} className="flex min-h-14 items-center justify-center py-6">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs text-white/40 font-mono tracking-wider">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载更多项目...
                </div>
              ) : !hasMore ? (
                <span className="text-[11px] text-white/25 font-mono tracking-wider">已加载全部项目</span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href={newProjectHref}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10
                  bg-white/[0.01] p-8 transition-all hover:border-primary/30 hover:bg-primary/[0.03] group min-h-[260px]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
                  <Plus className="h-6 w-6 text-white/30 group-hover:text-primary transition-colors" />
                </div>
                <span className="font-mono text-[11px] text-white/30 group-hover:text-primary/70 tracking-wider transition-colors">
                  新建项目
                </span>
              </Link>

              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/studio/${project.id}`)}
                  onDelete={(e) => handleDeleteClick(e, project.id)}
                  deleting={deletingId === project.id}
                  canDelete
                  showOwner={false}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="flex min-h-14 items-center justify-center py-6">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-xs text-white/40 font-mono tracking-wider">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载更多项目...
                </div>
              ) : !hasMore ? (
                <span className="text-[11px] text-white/25 font-mono tracking-wider">已加载全部项目</span>
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
