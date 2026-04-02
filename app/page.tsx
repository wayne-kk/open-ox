import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroVisual } from "./components/HeroVisual";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_requirement", detail: "理解意图 · 拆解页面 · 定义角色", color: "text-primary" },
  { id: "plan", label: "plan_project", detail: "蓝图 · 组件规划 · 设计方向", color: "text-accent-tertiary" },
  { id: "design", label: "generate_design_system", detail: "配色 · 字体 · 动效", color: "text-primary" },
  { id: "sections", label: "generate_sections ×N", detail: "并行生成 · 智能匹配 · 质量把控", color: "text-accent-tertiary" },
  { id: "build", label: "run_build", detail: "构建 · 类型检查 · 验证", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "自动修复 · 最多 2 轮", color: "text-orange-400" },
];

export default function Home() {
  return (
    <main className="relative isolate overflow-hidden min-h-screen">

      {/* ── Nav ── */}
      <header className="relative z-20 border-b border-white/8 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="defi-badge px-3 py-1 text-[11px] text-foreground tracking-[0.2em]">OPEN-OX</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Studio
            </span>
          </div>
          <Link href="/build-studio" className="defi-button px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase">
            开始创建 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-24 sm:pb-12 lg:px-8">
        {/* Big ambient glows */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/6 blur-[150px]" />
          <div className="absolute left-1/4 top-20 h-[300px] w-[400px] rounded-full bg-accent-tertiary/5 blur-[120px]" />
          <div className="absolute right-1/4 top-40 h-[250px] w-[350px] rounded-full bg-primary/4 blur-[100px]" />
        </div>

        {/* Center-aligned hero content */}
        <div className="relative z-10 text-center space-y-6 mb-14 sm:mb-20">
          <div className="flex justify-center gap-2">
            <span className="defi-badge px-3 py-1 text-[10px] text-primary">AI 驱动</span>
            <span className="defi-badge px-3 py-1 text-[10px] text-accent-tertiary gold-glow">一句话建站</span>
            <span className="defi-badge px-3 py-1 text-[10px] text-muted-foreground">即时预览</span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            描述你的想法
            <br />
            <span className="bitcoin-gradient-text">AI 秒级生成网站</span>
          </h1>

          <p className="mx-auto max-w-xl font-body text-base sm:text-lg leading-relaxed text-muted-foreground">
            输入一句话描述，AI 自动完成需求分析、设计系统、组件生成、构建验证。
            <br className="hidden sm:block" />
            从想法到可预览的完整网站，全程无需写一行代码。
          </p>

          <div className="flex justify-center gap-3 pt-2">
            <Link href="/build-studio" className="defi-button px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]">
              开始创建 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/projects" className="defi-button-outline px-8 py-3.5 text-sm font-medium">
              我的项目
            </Link>
          </div>
        </div>

        {/* Visual: AI building a website in real-time */}
        <HeroVisual />

        {/* Stats bar */}
        <div className="mt-14 sm:mt-20 flex justify-center gap-10 sm:gap-16 border-t border-white/6 pt-8">
          {[
            { value: "~90s", label: "生成耗时" },
            { value: "7+", label: "并行组件" },
            { value: "自动", label: "构建修复" },
            { value: "0", label: "代码编写" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-2xl sm:text-3xl font-bold text-primary">{value}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Agent Flow ── */}
      <section className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">// How it works</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">从描述到上线，6 步搞定</h2>
          <p className="mt-3 font-body text-sm text-muted-foreground">每次生成都经过完整的 AI 流水线，流程固定，质量可控。</p>
        </div>
        <AgentFlowDemo steps={AGENT_STEPS} />
      </section>

      {/* ── Feature cards ── */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              tag: "结构化流程",
              title: "不是聊天，是工程化生成",
              body: "固定的 6 步流水线，每一步有明确的输入输出，不会因为 AI 随机性跑偏。",
              border: "border-primary/30 hover:border-primary/60",
              label: "text-primary",
            },
            {
              tag: "智能匹配",
              title: "组件级 AI 能力调度",
              body: "根据组件类型自动匹配最合适的生成策略，Hero、表单、数据面板各有专长。",
              border: "border-accent-tertiary/25 hover:border-accent-tertiary/55",
              label: "text-accent-tertiary",
            },
            {
              tag: "自动修复",
              title: "构建失败？AI 自动修",
              body: "生成后自动构建验证，失败则进入修复流程，最多 2 轮，修不好会明确告知。",
              border: "border-white/10 hover:border-white/25",
              label: "text-muted-foreground",
            },
          ].map(({ tag, title, body, border, label }) => (
            <div key={tag} className={`defi-panel flex flex-col gap-4 p-6 transition-all duration-300 border ${border}`}>
              <span className={`font-mono text-[10px] uppercase tracking-[0.3em] ${label}`}>{tag}</span>
              <h3 className="font-heading text-base font-semibold leading-snug">{title}</h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
