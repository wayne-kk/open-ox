"use client";

import { Suspense, useState } from "react";
import { ChevronDown, MessageSquareText, Rocket, Workflow } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { GLSLHills } from "@/components/ui/glsl-hills";
import { HeroVisual } from "./components/HeroVisual";
import { HeroPrompt } from "./components/HeroPrompt";
import {
  HomeCommunityPreview,
  HomeCommunitySectionHeader,
} from "./components/HomeCommunityPreview";
import { cn } from "@/lib/utils";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_project_requirement", detail: "解析需求 · 输出最小蓝图（brief/site）", color: "text-foreground" },
  { id: "infer", label: "infer_design_intent", detail: "独立推理 · 视觉风格意图", color: "text-muted-foreground" },
  { id: "plan", label: "plan_project", detail: "蓝图细化 · 页面级纲要（无固定 section 清单）", color: "text-foreground" },
  { id: "design", label: "generate_design_system", detail: "色彩 · 字体 · 动效 · Token", color: "text-foreground" },
  { id: "scaffold", label: "architect_scaffold_agent", detail: "快速搭 chrome 骨架（链接可占位）", color: "text-muted-foreground" },
  { id: "pages", label: "page_implement_agent ×N", detail: "每路由工具循环实现页面与组件", color: "text-foreground" },
  { id: "optimize", label: "chrome_optimize_agent", detail: "读真实页面，精修 Nav 与 chrome", color: "text-muted-foreground" },
  { id: "build", label: "run_build", detail: "构建 · 类型检查 · 验证", color: "text-brand-signal" },
  { id: "repair", label: "repair_build", detail: "自动修复 · 最多 5 轮", color: "text-amber-400/90" },
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
    <div className="mt-8 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-2 rounded-full border border-white/8 bg-white/2 px-5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:border-white/16 hover:text-foreground"
        aria-expanded={open}
      >
        查看工程流水线
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-10 animate-fade-up">
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
    <main className="relative isolate min-h-dvh overflow-hidden">
      <section className="relative flex min-h-[min(100dvh,1120px)] flex-col items-center justify-center px-6 pb-36 pt-28 sm:pb-44 sm:pt-32 lg:px-8">
        <GLSLHills
          className="z-0 [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)]"
          cameraZ={125}
          speed={0.7}
        />
        {/* Soft handoff into the next section — kills the hard canvas cut */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-44 bg-gradient-to-b from-transparent via-background/70 to-background sm:h-56"
        />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <div className="defi-badge animate-fade-up inline-flex items-center gap-2 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-signal" />
            <span className="font-label text-[11px] text-muted-foreground">
              想法即刻实现，构建即刻运行
            </span>
          </div>

          <h1
            className="animate-fade-up mb-16 mt-10 bg-gradient-to-br from-white via-[#e4ddf7] to-primary bg-clip-text font-heading text-[clamp(2.5rem,6.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-transparent"
            style={{ animationDelay: "80ms" }}
          >
            THINK IT. BUILD IT.
          </h1>

          <div className="animate-fade-up mt-10" style={{ animationDelay: "200ms" }}>
            <Suspense
              fallback={
                <div className="mx-auto h-40 w-full max-w-3xl animate-pulse rounded-2xl border border-white/8 bg-card" />
              }
            >
              <HeroPrompt />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="relative -mt-10 px-6 pb-28 pt-2 sm:-mt-14 lg:px-8">
        <div className="container mx-auto">
          <HomeCommunitySectionHeader />
          <HomeCommunityPreview />
        </div>
      </section>

      <section className="relative border-t border-white/6 px-6 py-24 lg:px-8">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              // How it works
            </p>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.03em]">
              从描述到可交付站点，三步
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Harness 管住生成与验证；你负责方向与迭代。
            </p>
          </div>

          <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
            <ol className="space-y-2">
              {STORY_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className="group flex gap-4 rounded-2xl border border-transparent p-5 transition-colors hover:border-white/8 hover:bg-white/2"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-foreground/80 transition-colors group-hover:border-white/14">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em]">{title}</h3>
                    <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
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
