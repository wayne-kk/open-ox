 "use client";

import Link from "next/link";
import { ArrowRight, Cpu, GitBranch, Shield, Zap, Layers, Paintbrush } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroVisual } from "./components/HeroVisual";
import { HeroPrompt } from "./components/HeroPrompt";
import { SparkleHoverButton } from "@/components/ui/sparkle-hover-button";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_project_requirement", detail: "解析需求 · 输出最小蓝图（brief/site）", color: "text-primary" },
  { id: "infer", label: "infer_design_intent", detail: "独立推理 · 视觉风格意图", color: "text-accent-tertiary" },
  { id: "plan", label: "plan_project", detail: "蓝图细化 · section 规划", color: "text-primary" },
  { id: "design", label: "generate_design_system", detail: "色彩 · 字体 · 动效", color: "text-primary" },
  { id: "page-design", label: "describe_page_sections", detail: "先整页布局再拆分 section 设计", color: "text-accent-tertiary" },
  { id: "sections", label: "generate_sections ×N", detail: "并行生成 · 按 section brief 落地", color: "text-primary" },
  { id: "build", label: "run_build", detail: "构建 · 类型检查 · 验证", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "自动修复 · 最多 2 轮", color: "text-orange-400" },
];

const STATS = [
  { value: "2.5m", label: "平均生成时间", sub: "从描述到可运行站点" },
  { value: "8", label: "核心节点", sub: "每步有明确输入输出" },
  { value: "100+", label: "skill 发现", sub: "每个 section 运行时自发现 skill" },
  { value: "∞", label: "迭代修改", sub: "对话式持续优化" },
];

const FEATURES = [
  {
    icon: Cpu,
    tag: "Engineering System",
    title: "不是聊天机器人",
    body: "固定 8 个核心节点（含独立风格推理与页面级设计拆分），每步有明确输入输出定义。",
    accent: "primary" as const,
    metric: "8 nodes",
    metricLabel: "pipeline",
  },
  {
    icon: Layers,
    tag: "Smart Dispatch",
    title: "组件级 AI 路由",
    body: "Hero、表单、仪表盘 — 每种组件类型匹配最优的生成策略和 prompt 模板。",
    accent: "tertiary" as const,
    metric: "N×",
    metricLabel: "parallel",
  },
  {
    icon: Paintbrush,
    tag: "Design System",
    title: "自动设计系统",
    body: "从你的描述中提取品牌调性，生成完整的色彩、字体、间距 token 体系。",
    accent: "primary" as const,
    metric: "1:1",
    metricLabel: "consistent",
  },
  {
    icon: Shield,
    tag: "Auto Repair",
    title: "构建失败？AI 修",
    body: "生成后自动运行 build 验证，失败时 AI 诊断根因并修复，最多 2 轮。",
    accent: "tertiary" as const,
    metric: "2x",
    metricLabel: "auto-fix",
  },
  {
    icon: GitBranch,
    tag: "Modify Agent",
    title: "对话式迭代",
    body: "生成后用自然语言持续修改。Agent 搜索代码、精确编辑、验证构建 — 全自动。",
    accent: "primary" as const,
    metric: "∞",
    metricLabel: "iterations",
  },
  {
    icon: Zap,
    tag: "Real Code",
    title: "真实可运行代码",
    body: "输出的是 Next.js + Tailwind 项目，不是截图或原型。可以直接部署。",
    accent: "tertiary" as const,
    metric: "100%",
    metricLabel: "deployable",
  },
];

export default function Home() {
  const handleBuildClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="relative isolate overflow-hidden min-h-screen">

      {/* ─── HERO ─── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-24 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/7 blur-[180px]" />
          <div className="absolute left-1/4 bottom-1/3 h-[400px] w-[500px] rounded-full bg-accent-tertiary/5 blur-[140px]" />
        </div>

        <div className="relative z-10 mx-auto container px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary">AI-POWERED WEBSITE BUILDER</span>
          </div>

          <h1
            className="text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-[5.5rem] mb-10 mt-8"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Think it.
            <br />
            <span className="bitcoin-gradient-text">Build it.</span>
          </h1>

          <HeroPrompt />
        </div>

        <div className="relative z-10 mt-16 w-full max-w-5xl">
          <HeroVisual />
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative border-y border-white/6 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/6">
            {STATS.map(({ value, label, sub }) => (
              <div key={label} className="px-6 py-10 text-center lg:py-12">
                <div
                  className="text-3xl font-bold tracking-tight bitcoin-gradient-text lg:text-4xl"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {value}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{label}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground/50">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="mb-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">// How it works</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">从描述到上线，8 个核心节点</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
            结构化 AI 流水线 — 每一步都有明确职责，不漂移，不幻觉。
          </p>
        </div>
        <AgentFlowDemo steps={AGENT_STEPS} />
      </section>

      {/* ─── FEATURES ─── */}
      <section className="relative mx-auto max-w-7xl px-6 pb-28 lg:px-8">
        <div className="mb-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">// Capabilities</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">不只是生成，是工程</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            每个环节都有明确的工程保障 — 从设计系统到构建验证，从组件路由到自动修复。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, tag, title, body, accent, metric, metricLabel }) => (
            <div
              key={tag}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${accent === "primary"
                ? "border-primary/20 bg-primary/[0.03] hover:border-primary/40 hover:bg-primary/[0.06]"
                : "border-accent-tertiary/15 bg-accent-tertiary/[0.02] hover:border-accent-tertiary/35 hover:bg-accent-tertiary/[0.05]"
                }`}
            >
              {/* Top row: icon + metric */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent === "primary"
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-accent-tertiary/25 bg-accent-tertiary/10 text-accent-tertiary"
                    }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-bold leading-none ${accent === "primary" ? "text-primary/80" : "text-accent-tertiary/80"
                      }`}
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    {metric}
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mt-0.5">
                    {metricLabel}
                  </div>
                </div>
              </div>

              <span
                className={`font-mono text-[9px] uppercase tracking-[0.3em] ${accent === "primary" ? "text-primary/70" : "text-accent-tertiary/70"
                  }`}
              >
                {tag}
              </span>
              <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/80">{body}</p>

              {/* Subtle corner glow on hover */}
              <div
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${accent === "primary" ? "bg-primary/20" : "bg-accent-tertiary/15"
                  }`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative border-t border-white/6">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[160px]" />
        </div>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-4">// Get started</p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            描述你的想法
            <br />
            <span className="bitcoin-gradient-text">2 分钟后看到结果</span>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">
            不需要设计稿，不需要写代码。输入一段描述，AI 工程流水线帮你完成剩下的。
          </p>
          <div className="relative mt-8 flex items-center justify-center gap-4">
            <div className="relative">
              <SparkleHoverButton
                onClick={handleBuildClick}
                className="tracking-[0.1em]"
              >
                开始构建 <ArrowRight className="h-3.5 w-3.5" />
              </SparkleHoverButton>
            </div>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/3 px-6 py-3 font-mono text-[12px] font-medium tracking-[0.1em] text-muted-foreground transition-all hover:border-white/20 hover:text-foreground"
            >
              查看文档
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
