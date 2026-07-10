"use client";

import { Suspense, useState } from "react";
import { ChevronDown, MessageSquareText, Rocket, Workflow } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroVisual } from "./components/HeroVisual";
import { HeroPrompt } from "./components/HeroPrompt";
import {
  HomeCommunityPreview,
  HomeCommunitySectionHeader,
} from "./components/HomeCommunityPreview";
import { cn } from "@/lib/utils";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_project_requirement", detail: "解析需求 · 输出最小蓝图（brief/site）", color: "text-primary" },
  { id: "infer", label: "infer_design_intent", detail: "独立推理 · 视觉风格意图", color: "text-accent-tertiary" },
  { id: "plan", label: "plan_project", detail: "蓝图细化 · 页面级纲要（无固定 section 清单）", color: "text-primary" },
  { id: "design", label: "generate_design_system", detail: "色彩 · 字体 · 动效 · Token", color: "text-primary" },
  { id: "scaffold", label: "architect_scaffold_agent", detail: "快速搭 chrome 骨架（链接可占位）", color: "text-accent-tertiary" },
  { id: "pages", label: "page_implement_agent ×N", detail: "每路由工具循环实现页面与组件", color: "text-primary" },
  { id: "optimize", label: "chrome_optimize_agent", detail: "读真实页面，精修 Nav 与 chrome", color: "text-accent-tertiary" },
  { id: "build", label: "run_build", detail: "构建 · 类型检查 · 验证", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "自动修复 · 最多 5 轮", color: "text-orange-400" },
];

const STORY_STEPS = [
  {
    icon: MessageSquareText,
    title: "描述想法",
    body: "用自然语言说明站点目标与风格。不是闲聊 — 描述会进入结构化需求与设计意图。",
  },
  {
    icon: Workflow,
    title: "流水线生成可运行站点",
    body: "固定工程节点：规划、设计系统、页面实现、构建验证与自动修复。输出真实 Next.js 代码，不是截图原型。",
  },
  {
    icon: Rocket,
    title: "Studio 迭代上线",
    body: "在 Studio 里对话修改、预览与 Design Mode 精修，持续迭代直到可交付。",
  },
];

function PipelineDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-12 border-t border-white/6 pt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[12px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
        aria-expanded={open}
      >
        查看工程流水线
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-8">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            8 个核心节点 — 每步有明确输入输出，构建失败可自动修复。
          </p>
          <AgentFlowDemo steps={AGENT_STEPS} />
        </div>
      ) : null}
    </div>
  );
}

export function HomeMarketingPage() {
  return (
    <main className="cyber-scanlines relative isolate min-h-screen overflow-hidden">
      {/* ─── HERO ─── */}
      <section className="relative flex flex-col items-center px-6 pb-12 pt-28 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[180px]" />
          <div className="absolute bottom-1/3 left-1/4 h-[400px] w-[500px] rounded-full bg-accent-secondary/8 blur-[140px]" />
          <div className="absolute right-1/4 top-1/2 h-[300px] w-[400px] rounded-full bg-accent-tertiary/8 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
          <div className="defi-badge inline-flex items-center gap-2 px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            <span className="font-label text-[11px] text-primary">
              WEBSITE PRODUCTION ENGINE
            </span>
          </div>

          <h1 className="cyber-glitch mb-4 mt-8 font-heading text-5xl font-black leading-[1.04] tracking-widest sm:text-6xl lg:text-7xl">
            THINK IT.
            <br />
            <span className="bitcoin-gradient-text">BUILD IT.</span>
          </h1>
          <p className="blink-cursor mx-auto mb-10 max-w-xl text-base tracking-wide text-muted-foreground sm:text-lg">
            描述想法，得到可运行、可验证、可继续改的 WEBSITE — 工程流水线，不是聊天演示。
          </p>

          <Suspense
            fallback={
              <div className="cyber-chamfer mx-auto h-40 w-full max-w-4xl animate-pulse border border-primary/20 bg-card" />
            }
          >
            <HeroPrompt />
          </Suspense>
        </div>
      </section>

      {/* ─── COMMUNITY DISCOVER (below HeroPrompt) ─── */}
      <section className="relative px-6 pb-20 pt-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <HomeCommunitySectionHeader />
          <HomeCommunityPreview />
        </div>
      </section>

      {/* ─── THREE-STEP STORY ─── */}
      <section className="relative border-t border-white/6 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
              // How it works
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              从描述到可交付站点，三步
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Harness 管住生成与验证；你负责方向与迭代。
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <ol className="space-y-6">
              {STORY_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className="cyber-chamfer flex gap-4 border border-border bg-card/80 p-5 transition-colors hover:border-primary/40 hover:shadow-[var(--box-shadow-neon-sm)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary/40 bg-primary/10 text-primary shadow-[var(--box-shadow-neon-sm)]">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-1 text-[15px] font-semibold">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <HeroVisual />
            </div>
          </div>

          <PipelineDisclosure />
        </div>
      </section>
    </main>
  );
}
