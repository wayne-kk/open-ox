"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GitBranch, Monitor, RefreshCw, ExternalLink, PanelLeftClose, PanelLeftOpen, FileCode2, ImagePlus, Loader2, MousePointer2, X } from "lucide-react";
import { AppBackButton } from "@/app/components/AppBackButton";
import { StudioPublishMenu } from "@/app/components/ProjectPublishPanel";
import { cn } from "@/lib/utils";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBuildStudio } from "@/app/studio/hooks/useBuildStudio";
import { useFaviconSync } from "@/app/hooks/useFaviconSync";
import { BuildConversation } from "@/app/studio/components/BuildConversation";
import { DesignModePreviewOverlay } from "@/app/studio/components/DesignModePreviewOverlay";
import { GenerationAtlas } from "@/app/studio/components/GenerationAtlas";
import { ProjectCodePanel } from "@/app/studio/components/ProjectCodePanel";
import { useDesignMode } from "@/app/studio/hooks/useDesignMode";
import { filterPipelineSteps } from "@/app/studio/lib/pipelineSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StudioInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studio = useBuildStudio(projectId);
  const { loading, response, elapsed, rightPanel, setRightPanel,
    previewUrl, previewState, previewError, previewVersion, startPreview, iframeRef, projectLoading,
    autoPreviewAfterBuild, setAutoPreviewAfterBuild,
    bumpPreviewAfterDirectPatch,
    remixedFromTitle, remixedFromOwnerUsername,
  } = studio;
  const justRemixed = searchParams.get("remixed") === "1";
  const [lineageDismissed, setLineageDismissed] = useState(false);
  const showLineageBanner = !lineageDismissed && Boolean(remixedFromTitle);

  // Sync AI processing state → dynamic favicon
  useFaviconSync({
    loading: studio.loading,
    modifying: studio.modifying,
    error: studio.response?.error ?? studio.modifyError,
  });
  const buildSteps = response?.buildSteps ?? [];
  const pipelineSteps = filterPipelineSteps(buildSteps);
  const awaitingIntentInput = Boolean(
    response?.intentAgent &&
    response.intentAgent.status !== "commit_generate" &&
    pipelineSteps.length === 0 &&
    !loading
  );
  const canPreview = !!projectId && !loading;
  const canCode = !!projectId && !projectLoading;
  const [conversationCollapsed, setConversationCollapsed] = useState(false);
  const hasGeneratedProject = Boolean(
    response?.verificationStatus ||
    (response?.generatedFiles?.length ?? 0) > 0 ||
    (response?.blueprint && (response?.buildSteps?.length ?? 0) > 0)
  );
  const designMode = useDesignMode({
    projectId,
    iframeRef,
    previewUrl,
    previewReady: previewState === "ready" && Boolean(previewUrl),
    directEditCapable: studio.directEditCapable,
    onPreviewRefresh: bumpPreviewAfterDirectPatch,
    onHandoffToModify: (draft) => {
      studio.setModifyInstruction(draft);
      setConversationCollapsed(false);
    },
  });

  useEffect(() => {
    studio.setOnBeforeModifySend(() => designMode.consumeSelectionForModify());
    studio.setOnAfterModifySend(() => designMode.clearSelection());
    return () => {
      studio.setOnBeforeModifySend(null);
      studio.setOnAfterModifySend(null);
    };
    // Bind once per stable callbacks from designMode / studio setters
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable; rebind when selection helpers change
  }, [designMode.clearSelection, designMode.consumeSelectionForModify, studio.setOnAfterModifySend, studio.setOnBeforeModifySend]);

  const [coverCaptureBusy, setCoverCaptureBusy] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [coverCaptureHint, setCoverCaptureHint] = useState<string | null>(null);

  useEffect(() => {
    if (!coverCaptureHint) return;
    const t = setTimeout(() => setCoverCaptureHint(null), 10_000);
    return () => clearTimeout(t);
  }, [coverCaptureHint]);

  const dismissLineageBanner = useCallback(() => {
    setLineageDismissed(true);
    if (justRemixed) {
      router.replace(`/studio/${projectId}`, { scroll: false });
    }
  }, [justRemixed, projectId, router]);

  useEffect(() => {
    if (!justRemixed || !remixedFromTitle || lineageDismissed) return;
    const t = setTimeout(() => dismissLineageBanner(), 12_000);
    return () => clearTimeout(t);
  }, [dismissLineageBanner, justRemixed, lineageDismissed, remixedFromTitle]);

  const requestCoverCapture = useCallback(async () => {
    if (!projectId || coverCaptureBusy) return;
    setCoverCaptureBusy(true);
    setCoverCaptureHint(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/cover/capture`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (res.status === 401) {
        setCoverCaptureHint("请先登录后再更新封面图");
        return;
      }
      if (res.status === 403) {
        setCoverCaptureHint("仅项目所有者可以更新封面图");
        return;
      }
      if (res.status === 503) {
        setCoverCaptureHint("服务端未配置封面截图（需要 SUPABASE_SERVICE_ROLE_KEY）");
        return;
      }
      if (!res.ok && res.status !== 202) {
        setCoverCaptureHint(data.error ?? `更新失败 (${res.status})`);
        return;
      }
      setCoverCaptureHint("已开始截取当前预览首页，完成后请到项目列表查看新封面（约 1～3 分钟）");
    } catch {
      setCoverCaptureHint("网络错误，请稍后重试");
    } finally {
      setCoverCaptureBusy(false);
    }
  }, [projectId, coverCaptureBusy]);
  const previewIframeSrc =
    previewUrl
      ? `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}v=${previewVersion}`
      : null;

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
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            conversationCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <header className="border-b border-white/8 bg-background/80 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 px-4 py-0 h-12">
                {/* Left: back + brand */}
                <div className="flex items-center gap-3 min-w-0">
                  <AppBackButton
                    fallback="/projects"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/4 text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                  />

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
                        {pipelineSteps.length > 0 ? "BUILDING" : "THINKING"} · {formatMs(elapsed)}
                      </span>
                    </div>
                  ) : response?.error ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/8 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span className="font-mono text-[10px] text-red-400 tracking-[0.15em]">FAILED</span>
                    </div>
                  ) : awaitingIntentInput ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/8 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="font-mono text-[10px] text-amber-300 tracking-[0.15em]">AWAITING INPUT</span>
                    </div>
                  ) : response ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-green-400/25 bg-green-400/8 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <span className="font-mono text-[10px] text-green-400 tracking-[0.15em]">
                        {typeof response.buildTotalDuration === "number" &&
                        Number.isFinite(response.buildTotalDuration)
                          ? `DONE · ${formatMs(response.buildTotalDuration)}`
                          : "DONE"}
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
                  {projectId ? <StudioPublishMenu projectId={projectId} /> : null}
                  <Link
                    href="/projects"
                    className="hidden sm:flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
                  >
                    Projects
                  </Link>
                </div>
              </div>
            </header>
          </div>
        </div>

        {showLineageBanner && remixedFromTitle ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-400/20 bg-emerald-500/10 px-4 py-2">
            <p className="min-w-0 truncate text-[12px] text-emerald-100/90">
              已从 {remixedFromTitle}
              {remixedFromOwnerUsername ? `（${remixedFromOwnerUsername}）` : ""} Remix
            </p>
            <button
              type="button"
              onClick={dismissLineageBanner}
              className="shrink-0 rounded-md p-1 text-emerald-200/70 transition-colors hover:bg-white/10 hover:text-emerald-100"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div
            className={cn(
              "min-h-0 shrink-0 overflow-hidden transition-[max-height,width,min-width] duration-300 ease-out",
              "max-lg:h-[calc(100dvh-48px)] max-lg:max-h-[calc(100dvh-48px)] lg:max-h-none",
              conversationCollapsed
                ? "max-lg:max-h-0 pointer-events-none lg:w-0 lg:min-w-0 lg:max-w-0 lg:max-h-none"
                : "lg:w-[540px] lg:min-w-[540px] lg:max-w-[540px]",
            )}
          >
            <div className="h-full min-h-0 max-h-full overflow-hidden lg:h-full">
              <BuildConversation
                {...studio}
                designSelectionLabel={designMode.selectionBadgeLabel}
                onClearDesignSelection={designMode.clearSelection}
              />
            </div>
          </div>

          <section className="defi-glass flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Right panel toolbar */}
            <div className="flex shrink-0 flex-col border-b border-white/8">
              <div className="flex h-11 items-center px-3 gap-2">
              <button
                onClick={() => setConversationCollapsed((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2.5 h-7 font-mono text-[10px] text-muted-foreground/70 transition-all hover:border-white/15 hover:text-foreground"
                title={conversationCollapsed ? "展开对话流" : "收起对话流"}
              >
                {conversationCollapsed ? (
                  <>
                    <PanelLeftOpen className="h-3 w-3" />
                    Conversation
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="h-3 w-3" />
                    Conversation
                  </>
                )}
              </button>

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
                  onClick={() => setRightPanel("code")}
                  disabled={!canCode}
                  className={`flex items-center gap-1.5 px-3 h-7 font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${rightPanel === "code"
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                >
                  <FileCode2 className="h-3 w-3" />
                  Code
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

              <div className="hidden sm:flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2.5 h-7">
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
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action buttons — right */}
              {rightPanel === "preview" && previewState === "ready" && previewUrl && (
                <>
                  {hasGeneratedProject ? (
                    <button
                      type="button"
                      onClick={() => designMode.setActive(!designMode.active)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2.5 h-7 font-mono text-[10px] transition-all",
                        designMode.active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-white/8 bg-white/3 text-muted-foreground/70 hover:border-white/15 hover:text-foreground"
                      )}
                      title={
                        designMode.directEditCapable
                          ? "Pick elements to Direct-edit or send to Modify"
                          : "Pick an element, then describe the change in Modify"
                      }
                    >
                      <MousePointer2 className="h-3 w-3" />
                      {designMode.active ? "Exit pick" : "Design pick"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={requestCoverCapture}
                    disabled={coverCaptureBusy}
                    className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2.5 h-7 font-mono text-[10px] text-muted-foreground/70 transition-all hover:border-white/15 hover:text-foreground disabled:opacity-40"
                    title="用当前预览首页重新生成项目列表封面图"
                  >
                    {coverCaptureBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus className="h-3 w-3" aria-hidden />
                    )}
                    更新封面
                  </button>
                  <button
                    onClick={studio.rebuildPreview}
                    className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/3 px-2.5 h-7 font-mono text-[10px] text-muted-foreground/70 transition-all hover:border-white/15 hover:text-foreground"
                    title="Rebuild preview"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Rebuild
                  </button>
                  <a
                    href={previewIframeSrc ?? previewUrl}
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
              {rightPanel === "preview" && coverCaptureHint ? (
                <div className="border-t border-white/6 px-3 py-1.5 font-mono text-[10px] leading-snug text-primary/80">
                  {coverCaptureHint}
                </div>
              ) : null}
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
                    intentAgent={response?.intentAgent ?? studio.intentAgent}
                    showEventStream={false}
                  />
                </div>
              ) : rightPanel === "code" ? (
                <div className="h-full min-h-0 overflow-hidden">
                  <ProjectCodePanel projectId={projectId} />
                </div>
              ) : (
                <div className="relative flex h-full min-h-0 flex-col">
                  {previewState === "starting" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <HamsterLoader size="sm" />
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Starting preview…</p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">Usually a few seconds when cache is warm</p>
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
                    <div ref={previewContainerRef} className="relative flex flex-1 min-h-0">
                      <iframe
                        key={previewIframeSrc ?? `${previewUrl}_${previewVersion}`}
                        ref={iframeRef}
                        src={previewIframeSrc ?? previewUrl}
                        className="flex-1 w-full border-0"
                        title="Project Preview"
                      />
                      <DesignModePreviewOverlay
                        designMode={designMode}
                        iframeRef={iframeRef}
                        containerRef={previewContainerRef}
                      />
                    </div>
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
