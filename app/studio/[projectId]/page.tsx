"use client";

import { use } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, GitBranch, Monitor, RefreshCw, ExternalLink } from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBuildStudio } from "@/app/studio/hooks/useBuildStudio";
import { BuildConversation } from "@/app/studio/components/BuildConversation";
import { GenerationAtlas } from "@/app/studio/components/GenerationAtlas";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StudioInner({ projectId }: { projectId: string }) {
  const studio = useBuildStudio(projectId);
  const { loading, response, elapsed, rightPanel, setRightPanel,
    previewUrl, previewState, previewError, previewVersion, startPreview, iframeRef, projectLoading,
    autoPreviewAfterBuild, setAutoPreviewAfterBuild } = studio;
  const buildSteps = response?.buildSteps ?? [];
  const canPreview = !!projectId && !loading;

  if (projectLoading) {
    return (
      <main className="relative h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%)]" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <HamsterLoader size="sm" className="translate-x-1" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Loading project...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

      <div className="relative z-1 flex h-full flex-col">
        <header className="border-b border-white/8 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-0 h-12">
            {/* Left: back + brand */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/4 text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>

              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/40 bg-primary/10">
                  <span className="font-mono text-[9px] font-bold text-primary">OX</span>
                </div>
                <span className="font-mono text-[12px] font-semibold tracking-[0.12em] text-foreground hidden sm:block">
                  STUDIO
                </span>
                <span className="text-white/15 hidden sm:block">/</span>
                <span className="font-mono text-[11px] text-muted-foreground/50 truncate max-w-[180px] hidden md:block">
                  {studio.lastRunInput
                    ? (studio.lastRunInput.length > 40 ? studio.lastRunInput.slice(0, 40) + "…" : studio.lastRunInput)
                    : projectId.slice(0, 32) + "…"}
                </span>
              </div>
            </div>

            {/* Center: status pill */}
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-[10px] text-primary tracking-[0.15em]">
                    BUILDING · {formatMs(elapsed)}
                  </span>
                </div>
              ) : response?.error ? (
                <div className="flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/8 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="font-mono text-[10px] text-red-400 tracking-[0.15em]">FAILED</span>
                </div>
              ) : response ? (
                <div className="flex items-center gap-1.5 rounded-full border border-green-400/25 bg-green-400/8 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span className="font-mono text-[10px] text-green-400 tracking-[0.15em]">
                    {response.buildTotalDuration ? `DONE · ${formatMs(response.buildTotalDuration)}` : "DONE"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <span className="font-mono text-[10px] text-muted-foreground/50 tracking-[0.15em]">IDLE</span>
                </div>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/projects"
                className="hidden sm:flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
              >
                Projects
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <BuildConversation {...studio} />

          <section className="defi-glass flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Right panel toolbar */}
            <div className="flex h-11 items-center border-b border-white/8 px-3 gap-2">
              {/* Tab switcher — left */}
              <div className="flex items-center rounded-lg border border-white/8 bg-white/3 overflow-hidden">
                <button
                  onClick={() => setRightPanel("topology")}
                  className={`flex items-center gap-1.5 px-3 h-7 font-mono text-[10px] uppercase tracking-widest transition-all ${rightPanel === "topology"
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                >
                  <GitBranch className="h-3 w-3" />
                  Topology
                  {response && (
                    <span className={`ml-1 font-mono text-[9px] ${rightPanel === "topology" ? "text-primary" : "text-muted-foreground/40"}`}>
                      {buildSteps.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setRightPanel("preview")}
                  disabled={!canPreview}
                  className={`flex items-center gap-1.5 px-3 h-7 font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${rightPanel === "preview"
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                >
                  <Monitor className="h-3 w-3" />
                  Preview
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2.5 h-7">
                <Checkbox
                  id="auto-preview-after-build"
                  checked={autoPreviewAfterBuild}
                  onCheckedChange={(v) => setAutoPreviewAfterBuild(v === true)}
                />
                <Label
                  htmlFor="auto-preview-after-build"
                  className="cursor-pointer font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80"
                >
                  生成后预览
                </Label>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action buttons — right */}
              {previewState === "ready" && previewUrl && (
                <>
                  <button
                    onClick={studio.rebuildPreview}
                    className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2.5 h-7 font-mono text-[10px] text-muted-foreground/70 transition-all hover:border-white/15 hover:text-foreground"
                    title="Rebuild preview"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Rebuild
                  </button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2.5 h-7 font-mono text-[10px] text-muted-foreground/70 transition-all hover:border-white/15 hover:text-foreground"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                </>
              )}
            </div>

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
                <div className="flex h-full flex-col">
                  {previewState === "starting" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <HamsterLoader size="sm" />
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Starting dev server…</p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">First start may take 15–30s</p>
                    </div>
                  )}
                  {previewState === "error" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <p className="font-mono text-xs text-red-400">Preview failed</p>
                      <p className="font-mono text-[10px] text-muted-foreground max-w-sm text-center">{previewError}</p>
                      <button onClick={startPreview} className="defi-button-outline px-4 py-2 text-[11px] font-medium flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  )}
                  {previewState === "idle" && projectId && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <button onClick={startPreview} className="defi-button-outline px-5 py-2.5 text-[11px] font-medium flex items-center gap-2">
                        <Monitor className="h-4 w-4" /> Start Preview
                      </button>
                    </div>
                  )}
                  {previewState === "ready" && previewUrl && (
                    <iframe key={`${previewUrl}_${previewVersion}`} ref={iframeRef} src={previewUrl} className="flex-1 w-full border-0" title="Project Preview" />
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

export default function StudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <Suspense>
      <StudioInner projectId={projectId} />
    </Suspense>
  );
}
