"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, GitBranch, Monitor, RefreshCw, ExternalLink } from "lucide-react";
import { useBuildStudio } from "./hooks/useBuildStudio";
import { BuildConversation } from "./components/BuildConversation";
import { GenerationAtlas } from "./components/GenerationAtlas";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function BuildStudioInner() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? null;

  const studio = useBuildStudio(initialProjectId);
  const { loading, response, elapsed, rightPanel, setRightPanel, projectId,
    previewUrl, previewState, previewError, startPreview, iframeRef, projectLoading } = studio;
  const buildSteps = response?.buildSteps ?? [];
  const canPreview = !!projectId && !loading;

  if (projectLoading) {
    return (
      <main className="relative h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Loading project...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

      <div className="relative z-1 flex h-full flex-col">
        <header className="border-b border-white/8 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex items-center justify-between gap-4 px-6 py-2 lg:px-8">
            <div className="flex items-center gap-4">
              <Link href="/" className="defi-button-outline px-4 py-2 text-[11px] font-medium">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Build Studio</div>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Open-OX Studio
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <Link href="/projects" className="defi-button-outline px-3 py-1.5 text-[10px] font-medium">
                My Projects
              </Link>
              <span className="defi-badge px-3 py-1 text-primary">build_site</span>
              <span className="defi-badge px-3 py-1 text-accent-tertiary">live telemetry</span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <BuildConversation {...studio} />

          <section className="defi-glass flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Right panel header with toggle */}
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                  {rightPanel === "topology" ? <GitBranch className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    {rightPanel === "topology" ? "topology" : "preview"}
                  </div>
                  <div className="mt-0.5 font-mono text-xs uppercase tracking-[0.16em] text-foreground">
                    {loading
                      ? `running build_site · ${formatMs(elapsed)}`
                      : response
                        ? `build_site · ${buildSteps.length} steps`
                        : "console idle"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Panel toggle */}
                {canPreview && (
                  <div className="flex items-center rounded-lg border border-white/8 overflow-hidden">
                    <button
                      onClick={() => setRightPanel("topology")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${rightPanel === "topology" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"}`}
                    >
                      <GitBranch className="h-3 w-3" />
                      Topology
                    </button>
                    <button
                      onClick={() => setRightPanel("preview")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${rightPanel === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"}`}
                    >
                      <Monitor className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                )}

                {/* Open in new tab — only when preview is live */}
                {previewState === "ready" && previewUrl && (
                  <>
                    <button
                      onClick={studio.rebuildPreview}
                      className="defi-button-outline flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium"
                      title="Resync & Rebuild"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Rebuild
                    </button>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="defi-button-outline flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </>
                )}

                {/* Status badge */}
                {loading ? (
                  <span className="defi-badge px-3 py-1 text-primary">network live</span>
                ) : response ? (
                  <span className={`defi-badge px-3 py-1 ${response.error
                    ? "border border-red-400/35 text-red-400"
                    : response.verificationStatus === "failed"
                      ? "border border-amber-400/35 text-amber-300"
                      : "text-accent-tertiary"
                    }`}>
                    {response.error ? "failed"
                      : response.verificationStatus === "failed" ? "unvalidated"
                        : response.buildTotalDuration ? `done · ${formatMs(response.buildTotalDuration)}` : "done"}
                  </span>
                ) : (
                  <span className="font-mono uppercase tracking-[0.26em] text-muted-foreground">standby</span>
                )}
              </div>
            </div>

            {/* Right panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {rightPanel === "topology" ? (
                <div className="h-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))]">
                  <GenerationAtlas
                    steps={buildSteps}
                    flowStart={studio.flowStart}
                    loading={loading}
                    verificationStatus={response?.verificationStatus}
                    totalDuration={response?.buildTotalDuration}
                    showEventStream={false}
                  />
                </div>
              ) : (
                /* Preview panel */
                <div className="flex h-full flex-col">
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
                  {previewState === "idle" && projectId && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <button onClick={startPreview} className="defi-button-outline px-5 py-2.5 text-[11px] font-medium flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Start Preview
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
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function BuildStudioPage() {
  return (
    <Suspense>
      <BuildStudioInner />
    </Suspense>
  );
}
