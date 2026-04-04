"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Trash2, Plus, Clock, Layers, Pencil,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Globe,
} from "lucide-react";

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

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        group relative rounded-2xl border overflow-hidden transition-all duration-300
        ${isReady
          ? "border-white/10 hover:border-primary/40 cursor-pointer hover:shadow-[0_0_50px_-12px_rgba(247,147,26,0.25)] hover:-translate-y-1"
        : isFailed
          ? "border-red-400/20 hover:border-red-400/40 cursor-pointer hover:shadow-[0_0_30px_-12px_rgba(248,113,113,0.2)] hover:-translate-y-1"
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
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/50 line-clamp-2">
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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个项目吗？")) return;
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

      <div className="relative z-1 mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                onDelete={(e) => handleDelete(e, project.id)}
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
