"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, RefreshCw, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface ModifyStep {
  name: string;
  status: "running" | "done" | "error";
  message?: string;
}

interface DiffInfo {
  file: string;
  reasoning: string;
  patch: string;
  stats: { additions: number; deletions: number };
}

interface ModifyPlan {
  analysis: string;
  changes: Array<{ path: string; action: string; reasoning: string }>;
}

type SSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: ModifyPlan }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }
  | { type: "done" }
  | { type: "error"; message: string }

type PreviewState = "idle" | "starting" | "ready" | "error";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifySteps, setModifySteps] = useState<ModifyStep[]>([]);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [modifyPlan, setModifyPlan] = useState<ModifyPlan | null>(null);
  const [modifyDiffs, setModifyDiffs] = useState<DiffInfo[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/projects");
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const startPreview = async () => {
    setPreviewUrl(null);
    setPreviewState("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/projects/${id}/preview`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        setPreviewState("ready");
      } else {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? `HTTP ${res.status}`);
        setPreviewState("error");
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Network error");
      setPreviewState("error");
    }
  };

  useEffect(() => {
    startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleModify = async () => {
    if (!instruction.trim() || modifying) return;
    setModifying(true);
    setModifySteps([]);
    setModifyError(null);
    setModifyPlan(null);
    setModifyDiffs([]);

    try {
      const res = await fetch(`/api/projects/${id}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInstruction: instruction }),
      });

      if (!res.ok || !res.body) {
        setModifyError("Failed to start modification");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            if (event.type === "step") {
              setModifySteps((prev) => {
                const idx = prev.findIndex((s) => s.name === event.name);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { name: event.name, status: event.status, message: event.message };
                  return next;
                }
                return [...prev, { name: event.name, status: event.status, message: event.message }];
              });
            } else if (event.type === "plan") {
              setModifyPlan(event.plan);
            } else if (event.type === "diff") {
              setModifyDiffs((prev) => [...prev, { file: event.file, reasoning: event.reasoning, patch: event.patch, stats: event.stats }]);
            } else if (event.type === "error") {
              setModifyError(event.message);
            } else if (event.type === "done") {
              setInstruction("");
              if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setModifying(false);
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-background flex flex-col">
      {/* Confirm delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0f14] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white">确认删除</h3>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed mb-1">确定要删除这个项目吗？</p>
            <p className="text-[12px] text-red-400/60 mb-6">此操作不可撤销，项目所有数据将被永久删除。</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl px-4 py-2 text-[12px] font-medium text-white/60 border border-white/10 hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl px-4 py-2 text-[12px] font-medium text-white bg-red-500/80 hover:bg-red-500 border border-red-500/40 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-page loading overlay while deleting */}
      {deleting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-red-400" />
            <p className="font-mono text-sm text-white/60 tracking-wider">正在删除项目...</p>
            <p className="font-mono text-[10px] text-white/30">请勿关闭页面</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%)]" />

      <header className="relative z-10 border-b border-white/8 bg-background/75 backdrop-blur-xl shrink-0">
        <div className="mx-auto flex items-center justify-between gap-4 px-6 py-2 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="defi-button-outline px-4 py-2 text-[11px] font-medium flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Preview</div>
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-xs">{id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-widest ${previewState === "ready" ? "text-green-400" :
              previewState === "starting" ? "text-amber-300" :
                previewState === "error" ? "text-red-400" : "text-muted-foreground"
              }`}>
              {previewState === "starting" ? "● starting…" :
                previewState === "ready" ? "● live" :
                  previewState === "error" ? "● error" : "○ idle"}
            </span>
            {previewState !== "starting" && (
              <button
                onClick={startPreview}
                className="defi-button-outline px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Restart
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="defi-button-outline px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5 text-red-400/70 hover:text-red-400 hover:border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete project"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-1 flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col border-r border-white/8">
          {previewState === "starting" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Starting dev server…</p>
              <p className="font-mono text-[10px] text-muted-foreground/50">First start may take 15–30s</p>
            </div>
          )}
          {previewState === "error" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-red-400">Preview failed</p>
              <p className="font-mono text-[10px] text-muted-foreground max-w-sm text-center">{previewError}</p>
              <button onClick={startPreview} className="defi-button-outline px-4 py-2 text-[11px] font-medium flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}
          {previewState === "ready" && previewUrl && (
            <iframe
              key={previewUrl}
              ref={iframeRef}
              src={previewUrl}
              className="flex-1 w-full border-0"
              title="Project Preview"
            />
          )}
        </div>

        <div className="w-96 shrink-0 flex flex-col bg-background/80 backdrop-blur-xl">
          <div className="border-b border-white/8 px-5 py-3 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Modify</div>
            {modifying && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="font-mono text-[9px] text-primary uppercase tracking-widest">Processing</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="px-5 py-4 space-y-4">
              {modifySteps.length === 0 && !modifyError && !modifyPlan && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <p className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">No activity yet</p>
                  <p className="font-mono text-[9px] text-muted-foreground/20">Type an instruction below</p>
                </div>
              )}

              {/* AI Analysis card */}
              {modifyPlan && (
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/80">Analysis</span>
                  </div>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{modifyPlan.analysis}</p>
                  <div className="space-y-2 pt-1 border-t border-primary/10">
                    {modifyPlan.changes.map((c) => (
                      <div key={c.path} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 font-mono text-[10px] font-bold ${c.action === "create" ? "text-green-400" : c.action === "delete" ? "text-red-400" : "text-amber-300"}`}>
                          {c.action === "create" ? "NEW" : c.action === "delete" ? "DEL" : "MOD"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] text-foreground/60 truncate">{c.path}</p>
                          <p className="text-[9px] text-muted-foreground/40 leading-relaxed">{c.reasoning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps — compact */}
              {modifySteps.length > 0 && (
                <div className="space-y-1.5">
                  {modifySteps.map((step) => (
                    <div key={step.name} className="group">
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className={`shrink-0 ${step.status === "done" ? "text-green-400" : step.status === "error" ? "text-red-400" : "text-primary"}`}>
                          {step.status === "done" ? "✓" : step.status === "error" ? "✗" : (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
                          )}
                        </span>
                        <span className="text-muted-foreground/60 truncate">{step.name.replace(/:/g, " › ").replace(/_/g, " ")}</span>
                        {step.status === "done" && step.message?.match(/^\+\d+ -\d+/) && (
                          <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/30">{step.message}</span>
                        )}
                      </div>
                      {step.message && !step.message.match(/^\+\d+ -\d+/) && step.status !== "running" && (
                        <p className="ml-5 mt-0.5 text-[9px] text-muted-foreground/30 leading-relaxed line-clamp-2">{step.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Diffs */}
              {modifyDiffs.map((diff) => (
                <div key={diff.file} className="rounded-xl border border-white/6 overflow-hidden">
                  <div className="bg-white/3 px-4 py-2.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-foreground/60 truncate">{diff.file}</span>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[9px]">
                      <span className="text-green-400/70">+{diff.stats.additions}</span>
                      <span className="text-red-400/70">-{diff.stats.deletions}</span>
                    </div>
                  </div>
                  {diff.reasoning && (
                    <div className="px-4 py-2 border-b border-white/4">
                      <p className="text-[9px] text-primary/50 leading-relaxed">{diff.reasoning}</p>
                    </div>
                  )}
                  <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <pre className="px-4 py-3 font-mono text-[9px] leading-[1.6]">
                      {diff.patch.split("\n").map((line, i) => (
                        <div
                          key={i}
                          className={`px-1 -mx-1 ${line.startsWith("+++") || line.startsWith("---") ? "text-muted-foreground/20" :
                              line.startsWith("+") ? "text-green-400/70 bg-green-500/5 rounded-sm" :
                                line.startsWith("-") ? "text-red-400/70 bg-red-500/5 rounded-sm" :
                                  line.startsWith("@@") ? "text-blue-400/40 mt-2 mb-1" :
                                    "text-muted-foreground/20"
                            }`}
                        >
                          {line || " "}
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              ))}

              {modifyError && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                  <p className="font-mono text-[10px] text-red-400 break-words">{modifyError}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/8 p-4">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Describe what to change…"
              disabled={modifying}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none disabled:opacity-50 transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleModify(); }}
            />
            <button
              onClick={handleModify}
              disabled={modifying || !instruction.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-primary transition-all hover:bg-primary/15 hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send className="h-3 w-3" />
              {modifying ? "Modifying…" : "Apply Changes"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
