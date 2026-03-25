"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CircleCheckBig,
  Play,
  Trash2,
  GitBranch,
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

function getStepNarrative(step: BuildStep): { what: string; output: string; note?: string } {
  const s = step.step;
  const ok = step.status === "ok";

  if (s === "analyze_project_requirement") {
    return {
      what: "解析你的需求，提炼项目定位、目标用户、核心功能范围和设计风格方向。",
      output: ok ? "已生成项目简报（Brief），包含产品类型、受众画像、能力清单和体验关键词。" : "需求解析失败，无法继续后续规划。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "plan_project") {
    return {
      what: "基于简报进行全站规划，确定页面结构、各区块的设计意图和交互策略。",
      output: ok ? "已生成完整蓝图（Blueprint），包含页面地图、布局区块、设计计划和约束条件。" : "规划阶段失败，蓝图未能生成。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "generate_project_design_system") {
    return {
      what: "根据设计意图生成项目专属的设计系统，包括色彩、字体、间距和组件规范。",
      output: ok ? "设计系统文档已生成，后续所有区块将遵循此规范保持视觉一致性。" : "设计系统生成失败，区块样式可能不一致。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "apply_project_design_tokens") {
    return {
      what: "将设计系统的 Token（颜色变量、字体变量等）写入全局 CSS，使整站样式生效。",
      output: ok ? "globals.css 已更新，设计 Token 已注入，主题色和字体规范已就位。" : "Token 注入失败，全局样式可能未生效。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "clear_template") {
    return {
      what: "清理 Next.js 模板的默认内容，为生成的页面腾出干净的起点。",
      output: ok ? "模板已清空，默认页面和样式已移除。" : "模板清理失败，可能存在残留内容干扰。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "compose_layout") {
    return {
      what: "生成全局布局文件（layout.tsx），将共享 Shell 区块（如导航 HUD）组合进来。",
      output: ok ? "layout.tsx 已生成，全局导航和共享 Shell 已挂载。" : "布局文件生成失败，全局 Shell 可能缺失。",
      note: step.detail ?? undefined,
    };
  }
  if (s.startsWith("compose_page_")) {
    const pageName = s.replace("compose_page_", "");
    return {
      what: `组合「${pageName}」页面，将该页面下的所有区块按顺序拼装成完整的 page.tsx。`,
      output: ok ? `${pageName}/page.tsx 已生成，页面区块已按规划顺序组合完毕。` : `${pageName} 页面组合失败，该页面可能无法正常渲染。`,
      note: step.detail ?? undefined,
    };
  }
  if (s.startsWith("generate_section:") || s.startsWith("generate_section_")) {
    const sectionName = s.replace("generate_section:", "").replace(/^generate_section_[^_]+_/, "");
    return {
      what: `生成「${sectionName}」区块组件，依据设计计划实现布局、样式和交互逻辑。`,
      output: ok
        ? `${sectionName}.tsx 已生成${step.skillId ? `，使用了 ${step.skillId} 能力模板` : ""}。`
        : `${sectionName} 区块生成失败，该区块将缺失或显示异常。`,
      note: step.detail ?? undefined,
    };
  }
  if (s.startsWith("generate_section_layout_")) {
    const sectionName = s.replace("generate_section_layout_", "");
    return {
      what: `生成全局布局区块「${sectionName}」，这是跨页面共享的 Shell 组件。`,
      output: ok ? `${sectionName}.tsx 已生成并挂载到全局布局。` : `${sectionName} 布局区块生成失败。`,
      note: step.detail ?? undefined,
    };
  }
  if (s === "install_dependencies_generated") {
    return {
      what: "扫描所有生成文件中的 import，自动检测并安装缺失的 npm 依赖包。",
      output: ok ? "依赖安装完成，所有生成代码所需的第三方包已就位。" : "部分依赖安装失败，相关组件可能无法正常运行。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "verify_build") {
    return {
      what: "执行 next build 验证整站是否能正常编译，检查类型错误和构建问题。",
      output: ok ? "构建验证通过，所有页面和组件均可正常编译。" : "构建验证失败，存在编译错误需要修复。",
      note: step.detail ?? undefined,
    };
  }
  if (s === "repair_build") {
    return {
      what: "检测到构建错误，AI 正在自动分析错误信息并尝试修复有问题的文件。",
      output: ok ? "修复完成，构建错误已解决。" : "自动修复未能完全解决问题，可能需要手动介入。",
      note: step.detail ?? undefined,
    };
  }

  // fallback
  return {
    what: `执行步骤：${s}`,
    output: ok ? "步骤执行完成。" : "步骤执行失败。",
    note: step.detail ?? undefined,
  };
}

function StepRow({ step, flowStart }: { step: BuildStep; flowStart: number }) {
  const [open, setOpen] = useState(false);
  const isSection = step.step.startsWith("generate_section:");
  const stepLabel = isSection
    ? step.step.replace("generate_section:", "section:")
    : step.step;
  const narrative = getStepNarrative(step);

  return (
    <div className="rounded-xl hover:bg-white/3">
      <div
        className="flex cursor-pointer items-start gap-2 px-2 py-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="w-[68px] shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">
          [{formatTimestamp(step.timestamp, flowStart)}]
        </span>
        <span className={`shrink-0 pt-0.5 text-[11px] ${step.status === "ok" ? "text-primary" : "text-red-400"}`}>
          {step.status === "ok" ? ">" : "x"}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className={`break-all font-mono text-[11px] ${isSection ? "text-accent-tertiary" : "text-foreground"}`}>
            {stepLabel}
            {step.skillId ? (
              <span className="ml-1.5 text-[10px] text-accent-tertiary/80">[{step.skillId}]</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">
          +{formatMs(step.duration)}
        </span>
        <span className={`shrink-0 pt-0.5 text-[10px] transition-transform ${open ? "rotate-180" : ""} text-muted-foreground/40`}>
          ▾
        </span>
      </div>

      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-5">
          <div className="text-muted-foreground">{narrative.what}</div>
          <div className={`mt-1.5 ${step.status === "ok" ? "text-foreground/70" : "text-red-300/80"}`}>
            {narrative.output}
          </div>
          {narrative.note && (
            <div className="mt-1.5 break-words text-muted-foreground/50 italic">
              {narrative.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
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

function ChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  const variant =
    role === "user"
      ? "max-w-[86%] border-white/8 bg-white/[0.05] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
      : "w-full border-white/8 bg-[#151820]/82 shadow-[0_12px_30px_rgba(0,0,0,0.2)]";
  const align = role === "user" ? "justify-end" : "justify-start";

  return (
    <div className={`flex w-full min-w-0 ${align}`}>
      <div className={`min-w-0 rounded-[20px] border px-4 py-3 ${variant}`}>
        {children}
      </div>
    </div>
  );
}

function LogSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-3 min-w-0 overflow-hidden">{children}</div>
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
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [clearing, setClearing] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
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
    setLastRunInput(input);

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

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

      <div className="relative z-1 flex h-full flex-col">
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

        <div className="mx-auto flex w-full min-h-0 flex-1 flex-col gap-6 overflow-hidden px-6 py-6 lg:flex-row lg:px-8">
          <aside className="defi-panel flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[460px] lg:max-h-full">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Build conversation
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Describe what to build and watch the flow respond.
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] text-muted-foreground">
                Live
              </span>
            </div>

            <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
              <div className="space-y-5">
                {!response && !loading ? (
                  <ChatBubble role="assistant">
                    <div className="text-sm font-medium text-foreground">
                      你想构建什么？
                    </div>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      描述你想要的页面、应用或视觉系统，我会将它转化为一个完整的构建流程，并在这里实时推送每一步的执行详情。
                    </p>
                  </ChatBubble>
                ) : null}

                {lastRunInput ? (
                  <ChatBubble role="user">
                    <div className="text-[11px] font-medium text-foreground">You</div>
                    <pre className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                      {lastRunInput}
                    </pre>
                  </ChatBubble>
                ) : null}

                {response || loading ? (
                  <ChatBubble role="assistant">
                    <div className="text-[11px] font-medium text-foreground">
                      构建助手
                    </div>
                    <div className="mt-3 space-y-3">
                      <LogSection title="Command">
                        <TermLine prefix="$" color="text-white">
                          run build_site{" "}
                          <span className="text-muted-foreground">
                            &quot;
                            {(lastRunInput ?? input).length > 72
                              ? `${(lastRunInput ?? input).slice(0, 72)}...`
                              : lastRunInput ?? input}
                            &quot;
                          </span>
                        </TermLine>
                      </LogSection>

                      <LogSection title="执行日志">
                        <div className="space-y-0.5">
                          {response?.buildSteps?.map((step, index) => (
                            <StepRow
                              key={`${step.step}-${index}`}
                              step={step}
                              flowStart={flowStart}
                            />
                          ))}

                          {loading ? (
                            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                              <TermLine color="text-primary">
                                <span className="animate-pulse">[network_live]</span>
                                <span className="ml-2 text-muted-foreground">
                                  executing... {formatMs(elapsed)}
                                </span>
                              </TermLine>
                            </div>
                          ) : null}
                        </div>
                      </LogSection>

                      {response?.content ? (
                        <LogSection title="Summary">
                          <div className="space-y-1 text-[13px] leading-6 text-foreground">
                            {response.content.split("\n").filter(Boolean).map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                        </LogSection>
                      ) : null}

                      {response?.verificationStatus ? (
                        <LogSection title="Verification">
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
                        </LogSection>
                      ) : null}

                      {response?.installedDependencies &&
                        response.installedDependencies.length > 0 ? (
                        <LogSection title="Installed Dependencies">
                          <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-muted-foreground">
                            {buildIndentedList(
                              response.installedDependencies.map(
                                (item) =>
                                  `${item.packageName} <- ${item.files.join(", ")}`
                              )
                            )}
                          </pre>
                        </LogSection>
                      ) : null}

                      {response?.dependencyInstallFailures &&
                        response.dependencyInstallFailures.length > 0 ? (
                        <LogSection title="Dependency Install Failures">
                          <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-red-200/85">
                            {buildIndentedList(
                              response.dependencyInstallFailures.map(
                                (item) => `${item.packageName}: ${item.error}`
                              )
                            )}
                          </pre>
                        </LogSection>
                      ) : null}

                      {response?.generatedFiles && response.generatedFiles.length > 0 ? (
                        <LogSection title="Generated Files">
                          <pre className="overflow-x-hidden break-all text-[12px] leading-6 text-muted-foreground">
                            {buildFileTree(response.generatedFiles)}
                          </pre>
                        </LogSection>
                      ) : null}

                      {response?.blueprint ? (
                        <LogSection title="Blueprint Overview">
                          <div className="space-y-4 text-[12px]">
                            {/* Project Brief */}
                            <div className="space-y-1">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Project</div>
                              <div className="text-[13px] font-medium text-foreground">{response.blueprint.brief.projectTitle}</div>
                              <div className="leading-5 text-muted-foreground">{response.blueprint.brief.projectDescription}</div>
                            </div>

                            <div className="h-px bg-white/6" />

                            {/* Scope */}
                            <div className="space-y-2">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Scope</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-white/4 px-3 py-2">
                                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400/80">In scope</div>
                                  <ul className="space-y-1">
                                    {(response.blueprint.brief.productScope as any).inScope?.map((item: string, i: number) => (
                                      <li key={i} className="flex gap-1.5 leading-4 text-muted-foreground">
                                        <span className="mt-0.5 shrink-0 text-emerald-400/60">+</span>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="rounded-xl bg-white/4 px-3 py-2">
                                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-red-400/80">Out of scope</div>
                                  <ul className="space-y-1">
                                    {(response.blueprint.brief.productScope as any).outOfScope?.map((item: string, i: number) => (
                                      <li key={i} className="flex gap-1.5 leading-4 text-muted-foreground">
                                        <span className="mt-0.5 shrink-0 text-red-400/60">–</span>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="h-px bg-white/6" />

                            {/* Capabilities */}
                            <div className="space-y-2">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Capabilities</div>
                              <div className="space-y-2">
                                {response.blueprint.brief.capabilities.map((cap) => (
                                  <div key={cap.capabilityId} className="rounded-xl bg-white/4 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">{cap.name}</span>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${cap.priority === "must-have" ? "bg-primary/15 text-primary" : "bg-white/8 text-muted-foreground"}`}>
                                        {cap.priority}
                                      </span>
                                    </div>
                                    {(cap as any).summary && (
                                      <div className="mt-1 leading-5 text-muted-foreground">{(cap as any).summary}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="h-px bg-white/6" />

                            {/* User Roles */}
                            {(response.blueprint.brief as any).roles?.length > 0 && (
                              <div className="space-y-2">
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">User Roles</div>
                                {(response.blueprint.brief as any).roles.map((role: any) => (
                                  <div key={role.roleId} className="rounded-xl bg-white/4 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">{role.roleName}</span>
                                      {role.priority === "primary" && (
                                        <span className="rounded-full bg-accent-tertiary/15 px-2 py-0.5 text-[10px] font-mono text-accent-tertiary">primary</span>
                                      )}
                                    </div>
                                    {role.summary && <div className="mt-1 leading-5 text-muted-foreground">{role.summary}</div>}
                                    {role.goals?.length > 0 && (
                                      <div className="mt-2">
                                        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">Goals</div>
                                        <ul className="space-y-0.5">
                                          {role.goals.map((g: string, i: number) => (
                                            <li key={i} className="flex gap-1.5 leading-5 text-muted-foreground">
                                              <span className="shrink-0 text-primary/50">›</span>{g}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="h-px bg-white/6" />

                            {/* Task Loops */}
                            {(response.blueprint.brief as any).taskLoops?.length > 0 && (
                              <div className="space-y-2">
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Task Loops</div>
                                {(response.blueprint.brief as any).taskLoops.map((loop: any) => (
                                  <div key={loop.loopId} className="rounded-xl bg-white/4 px-3 py-2">
                                    <div className="font-medium text-foreground">{loop.name}</div>
                                    {loop.summary && <div className="mt-1 leading-5 text-muted-foreground">{loop.summary}</div>}
                                    {loop.steps?.length > 0 && (
                                      <ol className="mt-2 space-y-0.5">
                                        {loop.steps.map((s: string, i: number) => (
                                          <li key={i} className="flex gap-2 leading-5 text-muted-foreground">
                                            <span className="shrink-0 font-mono text-[10px] text-primary/50">{i + 1}.</span>{s}
                                          </li>
                                        ))}
                                      </ol>
                                    )}
                                    {loop.successState && (
                                      <div className="mt-2 flex gap-1.5 rounded-lg bg-emerald-400/8 px-2 py-1.5 text-[11px] text-emerald-300/80">
                                        <span className="shrink-0">✓</span>{loop.successState}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="h-px bg-white/6" />

                            {/* Design Intent */}
                            <div className="space-y-2">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Design Intent</div>
                              <div className="rounded-xl bg-white/4 px-3 py-2 space-y-2">
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Style · </span>
                                  <span className="text-muted-foreground">{response.blueprint.experience.designIntent.style}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Colors · </span>
                                  <span className="text-muted-foreground">{response.blueprint.experience.designIntent.colorDirection}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {response.blueprint.experience.designIntent.mood.map((m) => (
                                    <span key={m} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-foreground/70">{m}</span>
                                  ))}
                                  {response.blueprint.experience.designIntent.keywords.map((k) => (
                                    <span key={k} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary/70">{k}</span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="h-px bg-white/6" />

                            {/* Pages & Sections */}
                            <div className="space-y-2">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
                                Site · {response.blueprint.site.pages.length} pages
                              </div>
                              <div className="space-y-2">
                                {response.blueprint.site.pages.map((page) => (
                                  <div key={page.slug} className="rounded-xl bg-white/4 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">{page.title}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground/60">/{page.slug}</span>
                                    </div>
                                    {(page as any).description && (
                                      <div className="mt-1 leading-5 text-muted-foreground">{(page as any).description}</div>
                                    )}
                                    {page.sections.length > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                        {page.sections.map((section) => (
                                          <div key={section.fileName} className="rounded-lg bg-black/20 px-2.5 py-2">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-[11px] text-accent-tertiary">{section.fileName}</span>
                                              <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{section.type}</span>
                                            </div>
                                            {(section as any).intent && (
                                              <div className="mt-1 leading-4 text-[11px] text-muted-foreground">{(section as any).intent}</div>
                                            )}
                                            {(section as any).designPlan?.rationale && (
                                              <div className="mt-1.5 flex gap-1.5 rounded bg-white/4 px-2 py-1 text-[11px] leading-4 text-muted-foreground/70">
                                                <span className="shrink-0 text-primary/40">↳</span>
                                                {(section as any).designPlan.rationale}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </LogSection>
                      ) : null}

                      {response?.unvalidatedFiles &&
                        response.unvalidatedFiles.length > 0 ? (
                        <LogSection title="Unvalidated Files">
                          <pre className="overflow-x-hidden break-all text-[12px] leading-6 text-amber-100/80">
                            {buildFileTree(response.unvalidatedFiles)}
                          </pre>
                        </LogSection>
                      ) : null}

                      {response?.logDirectory ? (
                        <LogSection title="Log Directory">
                          <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-muted-foreground">
                            {response.logDirectory}
                          </pre>
                        </LogSection>
                      ) : null}

                      {response?.error ? (
                        <LogSection title="Error">
                          <TermLine color="text-red-400">error: {response.error}</TermLine>
                        </LogSection>
                      ) : null}

                      {response && !loading ? (
                        <div className="px-1 text-[12px] text-muted-foreground">
                          {response.error
                            ? "流程执行失败。"
                            : response.verificationStatus === "failed"
                              ? "流程完成，构建验证待处理。"
                              : "流程执行完毕。"}
                          {response.buildTotalDuration
                            ? ` 总耗时 ${formatMs(response.buildTotalDuration)}。`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </ChatBubble>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/8 px-4 py-4">
              <div className="rounded-[24px] border border-white/10 bg-black/25 p-3">
                <label className="sr-only" htmlFor="build-studio-input">
                  输入站点需求
                </label>
                <textarea
                  id="build-studio-input"
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/30"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !loading) {
                      event.preventDefault();
                      void handleRun();
                    }
                  }}
                  placeholder="Describe the page, app, or design system you want to generate..."
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={loading || clearing}
                    className="defi-button-outline flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {clearing ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Clear
                  </button>

                  <div className="hidden text-xs text-muted-foreground sm:block">
                    Cmd/Ctrl + Enter to run
                  </div>

                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={loading}
                    className="defi-button flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Running {formatMs(elapsed)}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Run
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="defi-glass flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    topology only
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
                {loading ? (
                  <span className="defi-badge px-3 py-1 text-primary">network live</span>
                ) : response ? (
                  <span
                    className={`defi-badge px-3 py-1 ${response.error
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

            <div className="flex-1 min-h-0 overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))] px-5 py-4 font-mono text-[12px]">
              <div className="flex h-full min-h-0 flex-col p-4">
                <GenerationAtlas
                  steps={buildSteps}
                  flowStart={flowStart}
                  loading={loading}
                  verificationStatus={response?.verificationStatus}
                  totalDuration={response?.buildTotalDuration}
                  showEventStream={false}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
