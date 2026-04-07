"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Trash2, Plus, Clock, Layers, Pencil,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Globe,
  AlertTriangle,
} from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";

interface ProjectMetadata {
  id: string;
  name: string;
  userPrompt: string;
  status: "generating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  verificationStatus?: "passed" | "failed";
  modificationHistory: unknown[];
}

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
  project, onDelete, onClick, deleting,
}: {
  project: ProjectMetadata;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
  deleting: boolean;
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
        </div>
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ── */
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
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!projects.some((p) => p.status === "generating")) return;
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, [projects, fetchProjects]);

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

  const readyCount = projects.filter((p) => p.status === "ready").length;
  const generatingCount = projects.filter((p) => p.status === "generating").length;

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
      {deletingId && <DeletingOverlay />}

      <div className="relative z-1 mx-auto max-w-6xl px-6 py-8 lg:px-8 min-h-screen">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 min-h-screen">
            <HamsterLoader size="sm" className="-mt-[200px]" />
            <p className="font-mono text-xs text-white/40 tracking-wider">加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02]">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-white">还没有项目</h2>
              <p className="text-sm text-white/40">描述你的想法，AI 帮你生成完整网站</p>
            </div>
            <Link href="/" className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em]">
              <Plus className="h-4 w-4" />
              创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* New project card */}
            <Link
              href="/"
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
              />
            ))}
          </div>
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
