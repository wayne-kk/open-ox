"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

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

function StatusBadge({ status }: { status: ProjectMetadata["status"] }) {
  const styles = {
    ready: "border border-green-400/35 text-green-400",
    generating: "border border-amber-400/35 text-amber-300",
    failed: "border border-red-400/35 text-red-400",
  };
  return (
    <span className={`defi-badge px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}

function VerificationBadge({ status }: { status?: "passed" | "failed" }) {
  if (!status) return null;
  return (
    <span className={`defi-badge px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${status === "passed" ? "border border-green-400/20 text-green-500" : "border border-amber-400/20 text-amber-400"}`}>
      {status === "passed" ? "verified" : "unverified"}
    </span>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Poll every 3s while any project is generating
  useEffect(() => {
    const hasGenerating = projects.some((p) => p.status === "generating");
    if (!hasGenerating) return;
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, [projects, fetchProjects]);

  const handleProjectClick = (project: ProjectMetadata) => {
    if (project.status === "ready") {
      router.push(`/build-studio?projectId=${project.id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个项目吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch { /* ignore */ }
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%)]" />

      <div className="relative z-1 flex flex-col">
        <header className="border-b border-white/8 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex items-center justify-between gap-4 px-6 py-2 lg:px-8">
            <div className="flex items-center gap-4">
              <Link href="/" className="defi-button-outline px-4 py-2 text-[11px] font-medium">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
                  Projects
                </div>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  PROJECT DASHBOARD
                </h1>
              </div>
            </div>
            <Link href="/build-studio" className="defi-button-outline px-4 py-2 text-[11px] font-medium">
              + New Project
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
          {loading ? (
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">No projects yet</p>
              <Link href="/build-studio" className="defi-button-outline px-6 py-2 text-[11px] font-medium">
                Build your first site
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className={`defi-glass rounded-xl border border-white/8 px-5 py-4 transition-colors ${project.status === "ready" ? "cursor-pointer hover:border-primary/40 hover:bg-white/5" : "cursor-default opacity-80"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{project.name}</span>
                        <StatusBadge status={project.status} />
                        <VerificationBadge status={project.verificationStatus} />
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground line-clamp-1">
                        {project.userPrompt.slice(0, 100)}{project.userPrompt.length > 100 ? "…" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, project.id)}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
