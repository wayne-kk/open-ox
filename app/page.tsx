import Link from "next/link";
import { ArrowRight, Cpu, GitBranch, Shield } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroVisual } from "./components/HeroVisual";
import { HeroPrompt } from "./components/HeroPrompt";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_requirement", detail: "Parse intent · Structure pages · Define roles", color: "text-primary" },
  { id: "plan", label: "plan_project", detail: "Blueprint · Component planning · Design direction", color: "text-accent-tertiary" },
  { id: "design", label: "generate_design_system", detail: "Colors · Typography · Motion", color: "text-primary" },
  { id: "sections", label: "generate_sections ×N", detail: "Parallel generation · Smart matching · QA", color: "text-accent-tertiary" },
  { id: "build", label: "run_build", detail: "Build · Type check · Validate", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "Auto-fix · Up to 2 rounds", color: "text-orange-400" },
];

const FEATURES = [
  {
    icon: Cpu,
    tag: "Structured Pipeline",
    title: "Not a chatbot. An engineering system.",
    body: "A fixed 6-step pipeline with defined inputs and outputs — no AI drift, no surprises.",
    accent: "primary" as const,
  },
  {
    icon: GitBranch,
    tag: "Smart Dispatch",
    title: "Component-level AI routing",
    body: "Each component type gets the right generation strategy — hero, form, dashboard, all handled differently.",
    accent: "tertiary" as const,
  },
  {
    icon: Shield,
    tag: "Auto Repair",
    title: "Build failed? AI fixes it.",
    body: "Post-generation build validation with up to 2 auto-repair rounds. If it can't fix it, it tells you why.",
    accent: "muted" as const,
  },
];

export default function Home() {
  return (
    <main className="relative isolate overflow-hidden min-h-screen">

      {/* ─────────────────────────────────────────
          HERO — full viewport
      ───────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-24 lg:px-8">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/7 blur-[180px]" />
          <div className="absolute left-1/4 bottom-1/3 h-[400px] w-[500px] rounded-full bg-accent-tertiary/5 blur-[140px]" />
        </div>

        {/* Text block */}
        <div className="relative z-10 mx-auto  container px-8 text-center ">
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

          {/* Prompt input */}
          <HeroPrompt />

        </div>

        {/* Hero visual — browser mockup */}
        <div className="relative z-10 mt-16 w-full max-w-5xl">
          <HeroVisual />
        </div>
      </section>

      {/* ─────────────────────────────────────────
          HOW IT WORKS
      ───────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="mb-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3">// How it works</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From prompt to live site in 6 steps</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
            A structured AI pipeline — every step has a defined role, no hallucinations, no drift.
          </p>
        </div>
        <AgentFlowDemo steps={AGENT_STEPS} />
      </section>

      {/* ─────────────────────────────────────────
          FEATURES
      ───────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 pb-28 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, tag, title, body, accent }) => (
            <div
              key={tag}
              className={`group relative overflow-hidden rounded-2xl border p-7 transition-all duration-300 ${accent === "primary"
                ? "border-primary/25 bg-primary/5 hover:border-primary/50 hover:bg-primary/8"
                : accent === "tertiary"
                  ? "border-accent-tertiary/20 bg-accent-tertiary/4 hover:border-accent-tertiary/45"
                  : "border-white/8 bg-white/3 hover:border-white/18"
                }`}
            >
              {/* Icon */}
              <div
                className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl border ${accent === "primary"
                  ? "border-primary/30 bg-primary/12 text-primary"
                  : accent === "tertiary"
                    ? "border-accent-tertiary/30 bg-accent-tertiary/12 text-accent-tertiary"
                    : "border-white/10 bg-white/6 text-muted-foreground"
                  }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span
                className={`font-mono text-[10px] uppercase tracking-[0.3em] ${accent === "primary" ? "text-primary" : accent === "tertiary" ? "text-accent-tertiary" : "text-muted-foreground"
                  }`}
              >
                {tag}
              </span>
              <h3 className="mt-2 font-heading text-[15px] font-semibold leading-snug">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
