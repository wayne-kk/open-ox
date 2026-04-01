import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroTerminal } from "./components/HeroTerminal";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_requirement", detail: "parsing intent · roles · pages", color: "text-primary" },
  { id: "plan", label: "plan_project", detail: "blueprint · sections · design tokens", color: "text-accent-tertiary" },
  { id: "design", label: "generate_design_system", detail: "color · typography · motion", color: "text-primary" },
  { id: "sections", label: "generate_sections ×7", detail: "parallel · skill-matched · guardrailed", color: "text-accent-tertiary" },
  { id: "build", label: "run_build", detail: "next build · type-check · verify", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "bounded repair · max 2 attempts", color: "text-orange-400" },
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
              AI Build Engine
            </span>
          </div>
          <Link href="/build-studio" className="defi-button px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase">
            Build Studio <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-7xl px-6 pt-20 pb-10 lg:px-8">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute right-1/4 top-20 h-[300px] w-[300px] rounded-full bg-accent-tertiary/6 blur-[100px]" />
        </div>

        <div className="grid gap-16 lg:grid-cols-2 lg:gap-12 lg:items-center">
          {/* Left: copy */}
          <div className="space-y-8">
            <div className="flex flex-wrap gap-2">
              <span className="defi-badge px-3 py-1 text-[10px] text-primary">Bounded Planning</span>
              <span className="defi-badge px-3 py-1 text-[10px] text-accent-tertiary gold-glow">Skill-Matched</span>
              <span className="defi-badge px-3 py-1 text-[10px] text-muted-foreground">Controlled Repair</span>
            </div>

            <div className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary">// AI Website Engine</p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                From prompt to{" "}
                <span className="bitcoin-gradient-text">production site</span>
                {" "}in one flow.
              </h1>
              <p className="max-w-lg font-body text-base leading-relaxed text-muted-foreground">
                不是 chat，不是拼图。是一个有结构的 agent 流程——分析需求、规划蓝图、并行生成、构建验证、受控修复。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/build-studio" className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em]">
                Start Building <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/projects" className="defi-button-outline px-6 py-3 text-sm font-medium">
                My Projects
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 border-t border-white/8 pt-6">
              {[
                { value: "~90s", label: "avg generation" },
                { value: "7+", label: "parallel sections" },
                { value: "2×", label: "repair attempts" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="font-mono text-xl font-bold text-primary">{value}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: terminal */}
          <div className="relative">
            <HeroTerminal />
          </div>
        </div>
      </section>

      {/* ── Agent Flow ── */}
      <section className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">// How it works</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">The generation pipeline</h2>
          <p className="mt-3 font-body text-sm text-muted-foreground">每次生成都经过这 6 个阶段，顺序固定，边界清晰。</p>
        </div>
        <AgentFlowDemo steps={AGENT_STEPS} />
      </section>

      {/* ── Architecture callouts ── */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              tag: "FLOW ENGINE",
              title: "Fixed pipeline, not open agent",
              body: "流程顺序固定，每个 step 有明确的输入输出契约，不会因为 LLM 随机性跑偏。",
              border: "border-primary/30 hover:border-primary/60",
              label: "text-primary",
            },
            {
              tag: "SKILL SYSTEM",
              title: "Metadata-first skill selection",
              body: "先用 metadata 选 skill，再加载完整 prompt。两层注入，context 不膨胀。",
              border: "border-accent-tertiary/25 hover:border-accent-tertiary/55",
              label: "text-accent-tertiary",
            },
            {
              tag: "REPAIR LOOP",
              title: "Bounded repair, not infinite retry",
              body: "构建失败进入受控 repair，最多 2 次，失败后标记文件而不是静默跳过。",
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
