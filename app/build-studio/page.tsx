"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  ChartNoAxesCombined,
  CircleCheckBig,
  Coins,
  Play,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  WandSparkles,
  GitBranch,
  Package
} from "lucide-react";
import { GenerationAtlas } from "./components/GenerationAtlas";

interface BuildStep {
  step: string;
  status: "ok" | "error";
  detail?: string;
  timestamp: number;
  duration: number;
  skillId?: string | null;
}

interface PlannedProjectBlueprint {
  brief: {
    projectTitle: string;
    projectDescription: string;
    productScope: {
      productType: string;
      coreOutcome: string;
      audienceSummary: string;
    };
    roles: Array<{
      roleId: string;
      roleName: string;
    }>;
    taskLoops: Array<{
      loopId: string;
      name: string;
    }>;
    capabilities: Array<{
      capabilityId: string;
      name: string;
      priority: string;
    }>;
  };
  experience: {
    designIntent: {
      mood: string[];
      style: string;
      colorDirection: string;
      keywords: string[];
    };
  };
  site: {
    informationArchitecture: {
      navigationModel: string;
      pageMap: Array<{
        slug: string;
        title: string;
        purpose: string;
        journeyStage: string;
      }>;
    };
    layoutSections: Array<{
      fileName: string;
      type: string;
    }>;
    pages: Array<{
      slug: string;
      title: string;
      sections: Array<{
        fileName: string;
        type: string;
      }>;
    }>;
  };
}

interface AiResponse {
  content: string;
  generatedFiles?: string[];
  blueprint?: PlannedProjectBlueprint;
  verificationStatus?: "passed" | "failed";
  unvalidatedFiles?: string[];
  installedDependencies?: Array<{
    packageName: string;
    dev: boolean;
    trigger: string;
    files: string[];
  }>;
  dependencyInstallFailures?: Array<{
    packageName: string;
    dev: boolean;
    trigger: string;
    files: string[];
    error: string;
  }>;
  buildSteps?: BuildStep[];
  buildTotalDuration?: number;
  logDirectory?: string;
  error?: string;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(epochMs: number, flowStartMs: number): string {
  const elapsed = epochMs - flowStartMs;
  const s = Math.floor(elapsed / 1000);
  const ms = elapsed % 1000;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function buildFileTree(files: string[]): string {
  if (files.length === 0) return "";

  return files
    .map((file, index) => {
      const isLast = index === files.length - 1;
      return `  ${isLast ? "└──" : "├──"} ${file}`;
    })
    .join("\n");
}

function buildIndentedList(values: string[]): string {
  if (values.length === 0) return "";

  return values.map((value) => `  - ${value}`).join("\n");
}

function buildPageTree(
  pages: PlannedProjectBlueprint["site"]["pages"]
): string {
  if (pages.length === 0) return "";

  return pages
    .map((page) => {
      const sectionList =
        page.sections.length > 0
          ? page.sections.map((section) => `${section.fileName} <${section.type}>`).join(", ")
          : "no sections";
      return `  - ${page.title} (${page.slug})\n    ${sectionList}`;
    })
    .join("\n");
}

function TermLine({
  prefix,
  children,
  color = "text-[#c7d0dc]",
  dim = false,
}: {
  prefix?: string;
  children: ReactNode;
  color?: string;
  dim?: boolean;
}) {
  return (
    <div className={`flex gap-2 font-mono text-[12px] leading-6 tracking-[0.04em] ${dim ? "opacity-60" : ""}`}>
      {prefix ? (
        <span className="shrink-0 select-none text-muted-foreground">{prefix}</span>
      ) : null}
      <span className={color}>{children}</span>
    </div>
  );
}

export default function BuildStudioPage() {
  const [input, setInput] = useState(
    "我想搭建一个万圣节宣传页面，赛博朋克风格，主要包含活动介绍、特色亮点、活动时间表和报名入口。"
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [viewMode, setViewMode] = useState<"log" | "atlas">("atlas");
  const [clearing, setClearing] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [response, loading]);

  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAt);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, startedAt]);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch("/api/clear-template", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        console.error("[clear-template]", data.error);
      }
    } finally {
      setClearing(false);
    }
  }

  async function handleRun() {
    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("SSE stream unavailable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const chunk of lines) {
            const line = chunk.replace(/^data:\s*/, "").trim();
            if (!line) continue;

            try {
              const event = JSON.parse(line) as {
                type: "step" | "done" | "error";
                [key: string]: unknown;
              };

              if (event.type === "step") {
                const step = event as unknown as BuildStep;
                setResponse((prev) => ({
                  content: prev?.content ?? "",
                  generatedFiles: prev?.generatedFiles,
                  verificationStatus: prev?.verificationStatus,
                  unvalidatedFiles: prev?.unvalidatedFiles,
                  installedDependencies: prev?.installedDependencies,
                  dependencyInstallFailures: prev?.dependencyInstallFailures,
                  buildTotalDuration: prev?.buildTotalDuration,
                  logDirectory: prev?.logDirectory,
                  buildSteps: [...(prev?.buildSteps ?? []), step],
                }));
              } else if (event.type === "done") {
                setResponse((prev) => ({
                  ...(event.result as AiResponse),
                  buildSteps:
                    (event.result as AiResponse).buildSteps ?? prev?.buildSteps,
                }));
              } else if (event.type === "error") {
                setResponse({ content: "", error: String(event.message) });
              }
            } catch {
              // Ignore malformed SSE chunks.
            }
          }
        }
      } else {
        setResponse((await res.json()) as AiResponse);
      }
    } catch (err) {
      setResponse({
        content: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  const buildSteps = response?.buildSteps ?? [];
  const showAtlas = viewMode === "atlas" && (buildSteps.length > 0 || loading);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

      <div className="relative z-1 flex min-h-screen flex-col">
        <header className="border-b border-white/8 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="defi-button-outline px-4 py-2 text-[11px] font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
                  Build Studio
                </div>
                <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  OPEN-OX DEFI BUILD CONSOLE
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="defi-badge px-3 py-1 text-primary">build_site</span>
              <span className="defi-badge px-3 py-1 text-accent-tertiary">
                live telemetry
              </span>
              <span className="hidden font-mono uppercase tracking-[0.26em] text-muted-foreground sm:inline">
                bounded planning + repair branch
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full container flex-1 flex-col gap-6 px-6 py-6 lg:flex-row lg:px-8">
          <aside className="defi-panel flex w-full shrink-0 flex-col gap-5 p-5 lg:w-[380px]">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-primary shadow-[0_0_20px_rgba(234,88,12,0.22)]">
                  <WandSparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Input Signal
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    Describe the site you want to generate
                  </div>
                </div>
              </div>

              <p className="font-body text-sm leading-7 text-muted-foreground">
                这里保留真实 AI 建站链路入口。视觉上不再是 hacker console，而是更像一个
                高可信 DeFi 操作台：深色基底、橙金发光、清晰分层和可验证的步骤反馈。
              </p>
            </div>

            <div className="defi-glass p-4">
              <div className="mb-3 flex items-center justify-between border-b border-white/8 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  request.payload
                </span>
                <span className="font-mono text-[11px] text-primary">stdin</span>
              </div>

              <label className="sr-only" htmlFor="build-studio-input">
                输入站点需求
              </label>
              <textarea
                id="build-studio-input"
                rows={10}
                className="defi-input min-h-[220px] w-full resize-none rounded-lg border-0 bg-black/35 px-0 pt-2 pb-4 font-body text-[14px] leading-7 tracking-[0.01em] text-foreground placeholder:text-white/30"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入自然语言需求，例如：做一个高对比、霓虹感、含 Hero / Features / CTA 的活动页"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <Blocks className="h-4 w-4 text-primary" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Flow
                  </div>
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                  analyze - plan - generate - build
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <ChartNoAxesCombined className="h-4 w-4 text-primary" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Output
                  </div>
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                  streamed step telemetry
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent-tertiary" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Repair
                  </div>
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                  controlled branch only
                </div>
              </div>
            </div>

            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || clearing}
                className="defi-button-outline flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear Template
              </button>
              <button
                type="button"
                onClick={handleRun}
                disabled={loading}
                className="defi-button flex flex-1 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Running {formatMs(elapsed)}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Build Flow
                  </>
                )}
              </button>
            </div>
          </aside>

          <section className="defi-glass flex min-h-[520px] flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                  <TerminalSquare className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    live build log
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-foreground">
                    {loading
                      ? `running build_site · ${formatMs(elapsed)}`
                      : response
                        ? `build_site · ${response.buildSteps?.length ?? 0} steps`
                        : "console idle"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                {(buildSteps.length > 0 || loading) ? (
                  <div className="flex rounded-lg border border-white/10 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("atlas")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                        viewMode === "atlas"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Atlas
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("log")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                        viewMode === "log"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <TerminalSquare className="h-3.5 w-3.5" />
                      Log
                    </button>
                  </div>
                ) : null}
                {loading ? (
                  <span className="defi-badge px-3 py-1 text-primary">network live</span>
                ) : response ? (
                  <span
                    className={`defi-badge px-3 py-1 ${
                      response.error
                        ? "border border-red-400/35 text-red-400"
                        : response.verificationStatus === "failed"
                          ? "border border-amber-400/35 text-amber-300"
                          : "text-accent-tertiary"
                    }`}
                  >
                    {response.error
                      ? "failed"
                      : response.verificationStatus === "failed"
                        ? "unvalidated"
                      : response.buildTotalDuration
                        ? `done · ${formatMs(response.buildTotalDuration)}`
                        : "done"}
                  </span>
                ) : (
                  <span className="font-mono uppercase tracking-[0.26em] text-muted-foreground">
                    standby
                  </span>
                )}
              </div>
            </div>

            <div
              ref={terminalRef}
              className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))] px-5 py-4 font-mono text-[12px]"
            >
              {showAtlas ? (
                <div className="flex h-full min-h-[480px] flex-col p-4">
                  <GenerationAtlas
                    steps={buildSteps}
                    flowStart={flowStart}
                    loading={loading}
                    verificationStatus={response?.verificationStatus}
                    totalDuration={response?.buildTotalDuration}
                  />
                </div>
              ) : !response && !loading ? (
                <div className="flex h-full min-h-[420px] items-center justify-center">
                  <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_30px_-8px_rgba(247,147,26,0.45)]">
                      <Coins className="h-7 w-7" />
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Awaiting command
                    </div>
                    <p className="mt-4 font-body text-sm leading-7 text-muted-foreground">
                      把左侧需求写清楚，运行后这里会实时展示 flow 步骤、构建结果和生成文件。
                    </p>
                  </div>
                </div>
              ) : null}

              {!showAtlas && (response || loading) ? (
                <div className="space-y-1">
                  <TermLine prefix="$" color="text-white">
                    run build_site{" "}
                    <span className="text-muted-foreground">
                      &quot;{input.length > 72 ? `${input.slice(0, 72)}...` : input}&quot;
                    </span>
                  </TermLine>

                  <div className="my-3 border-t border-white/8" />

                  {response?.buildSteps?.map((step, index) => {
                    const isSection = step.step.startsWith("generate_section:");
                    const stepLabel = isSection
                      ? step.step.replace("generate_section:", "section:")
                      : step.step;

                    return (
                      <div key={`${step.step}-${index}`} className="flex items-baseline gap-3">
                        <span className="w-[76px] shrink-0 text-[10px] text-muted-foreground">
                          [{formatTimestamp(step.timestamp, flowStart)}]
                        </span>
                        <span
                          className={`shrink-0 text-[11px] ${
                            step.status === "ok" ? "text-primary" : "text-red-400"
                          }`}
                        >
                          {step.status === "ok" ? ">" : "x"}
                        </span>
                        <span
                          className={`min-w-[220px] shrink-0 ${
                            isSection ? "text-accent-tertiary" : "text-primary"
                          }`}
                        >
                          {stepLabel}
                          {step.skillId ? (
                            <span className="ml-1.5 font-mono text-[10px] text-accent-tertiary/80">
                              [{step.skillId}]
                            </span>
                          ) : null}
                        </span>
                        {step.detail ? (
                          <span className="truncate text-muted-foreground">{step.detail}</span>
                        ) : null}
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          +{formatMs(step.duration)}
                        </span>
                      </div>
                    );
                  })}

                  {loading ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-primary">
                        <span className="animate-pulse">[network_live]</span>
                        <span className="ml-2 text-muted-foreground">
                          executing... {formatMs(elapsed)}
                        </span>
                      </TermLine>
                    </>
                  ) : null}

                  {response?.error ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-red-400">error: {response.error}</TermLine>
                    </>
                  ) : null}

                  {response?.content ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine
                        color={
                          response.verificationStatus === "failed"
                            ? "text-amber-300"
                            : "text-muted-foreground"
                        }
                        dim={response.verificationStatus !== "failed"}
                      >
                        summary
                      </TermLine>
                      <pre className="mt-2 whitespace-pre-wrap text-white">
                        {response.content}
                      </pre>
                    </>
                  ) : null}

                  {response?.verificationStatus ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine
                        color={
                          response.verificationStatus === "passed"
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {response.verificationStatus === "passed" ? (
                          <>
                            <CircleCheckBig className="mr-2 inline h-4 w-4" />
                            verification_passed
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="mr-2 inline h-4 w-4" />
                            verification_failed
                          </>
                        )}
                      </TermLine>
                    </>
                  ) : null}

                  {response?.installedDependencies &&
                  response.installedDependencies.length > 0 ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-emerald-300">
                        <Package className="mr-2 inline h-4 w-4" />
                        installed_dependencies ({response.installedDependencies.length})
                      </TermLine>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-muted-foreground">
                        {buildIndentedList(
                          response.installedDependencies.map(
                            (item) =>
                              `${item.packageName} <- ${item.files.join(", ")}`
                          )
                        )}
                      </pre>
                    </>
                  ) : null}

                  {response?.dependencyInstallFailures &&
                  response.dependencyInstallFailures.length > 0 ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-red-400">
                        dependency_install_failures (
                        {response.dependencyInstallFailures.length})
                      </TermLine>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-red-200/85">
                        {buildIndentedList(
                          response.dependencyInstallFailures.map(
                            (item) =>
                              `${item.packageName}: ${item.error}`
                          )
                        )}
                      </pre>
                    </>
                  ) : null}

                  {response?.generatedFiles && response.generatedFiles.length > 0 ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-accent-tertiary">
                        generated_files ({response.generatedFiles.length})
                      </TermLine>
                      <pre className="mt-2 text-[11px] leading-6 text-muted-foreground">
                        {buildFileTree(response.generatedFiles)}
                      </pre>
                    </>
                  ) : null}

                  {response?.blueprint ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-primary">
                        blueprint.overview
                      </TermLine>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-muted-foreground">
                        {[
                          `brief`,
                          `  title: ${response.blueprint.brief.projectTitle}`,
                          `  type: ${response.blueprint.brief.productScope.productType}`,
                          `  audience: ${response.blueprint.brief.productScope.audienceSummary}`,
                          `  outcome: ${response.blueprint.brief.productScope.coreOutcome}`,
                          ``,
                          `experience`,
                          `  mood: ${response.blueprint.experience.designIntent.mood.join(", ") || "none"}`,
                          `  style: ${response.blueprint.experience.designIntent.style}`,
                          `  colors: ${response.blueprint.experience.designIntent.colorDirection}`,
                          `  keywords: ${response.blueprint.experience.designIntent.keywords.join(", ") || "none"}`,
                          ``,
                          `site`,
                          `  navigation: ${response.blueprint.site.informationArchitecture.navigationModel}`,
                          `  layout sections: ${response.blueprint.site.layoutSections.map((section) => `${section.fileName} <${section.type}>`).join(", ") || "none"}`,
                          `  pages: ${response.blueprint.site.pages.length}`,
                          buildPageTree(response.blueprint.site.pages),
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      </pre>
                    </>
                  ) : null}

                  {response?.unvalidatedFiles &&
                  response.unvalidatedFiles.length > 0 ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine color="text-amber-300">
                        unvalidated_files ({response.unvalidatedFiles.length})
                      </TermLine>
                      <pre className="mt-2 text-[11px] leading-6 text-amber-100/80">
                        {buildFileTree(response.unvalidatedFiles)}
                      </pre>
                    </>
                  ) : null}

                  {response?.logDirectory ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine dim color="text-muted-foreground">
                        log_directory
                      </TermLine>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-muted-foreground">
                        {response.logDirectory}
                      </pre>
                    </>
                  ) : null}

                  {response && !loading ? (
                    <>
                      <div className="my-3 border-t border-white/8" />
                      <TermLine
                        color={
                          response.error
                            ? "text-red-400"
                            : response.verificationStatus === "failed"
                              ? "text-amber-300"
                              : "text-primary"
                        }
                      >
                        {response.error
                          ? "flow failed"
                          : response.verificationStatus === "failed"
                            ? "flow complete · validation pending"
                            : "flow complete"}
                        {response.buildTotalDuration
                          ? ` · ${formatMs(response.buildTotalDuration)}`
                          : ""}
                      </TermLine>
                      <TermLine prefix="$" color="text-muted-foreground">
                        <span className="blink-cursor">ready</span>
                      </TermLine>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
