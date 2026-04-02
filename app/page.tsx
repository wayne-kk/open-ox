import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentFlowDemo } from "./components/AgentFlowDemo";
import { HeroVisual } from "./components/HeroVisual";

const AGENT_STEPS = [
  { id: "analyze", label: "analyze_requirement", detail: "Parse intent · Structure pages · Define roles", color: "text-primary" },
  { id: "plan", label: "plan_project", detail: "Blueprint · Component planning · Design direction", color: "text-accent-tertiary" },
  { id: "design", label: "generate_design_system", detail: "Colors · Typography · Motion", color: "text-primary" },
  { id: "sections", label: "generate_sections ×N", detail: "Parallel generation · Smart matching · QA", color: "text-accent-tertiary" },
  { id: "build", label: "run_build", detail: "Build · Type check · Validate", color: "text-green-400" },
  { id: "repair", label: "repair_build", detail: "Auto-fix · Up to 2 rounds", color: "text-orange-400" },
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
            Start Building <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-24 sm:pb-12 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/6 blur-[150px]" />
          <div className="absolute left-1/4 top-20 h-[300px] w-[400px] rounded-full bg-accent-tertiary/5 blur-[120px]" />
          <div className="absolute right-1/4 top-40 h-[250px] w-[350px] rounded-full bg-primary/4 blur-[100px]" />
        </div>

        <div className="relative z-10 text-center space-y-6 mb-14 sm:mb-20">
          <div className="flex justify-center gap-2">
            <span className="defi-badge px-3 py-1 text-[10px] text-primary">AI-Powered</span>
            <span className="defi-badge px-3 py-1 text-[10px] text-accent-tertiary gold-glow">One Prompt</span>
            <span className="defi-badge px-3 py-1 text-[10px] text-muted-foreground">Instant Preview</span>
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            Think It.
            <br />
            <span className="bitcoin-gradient-text">Build It.</span>
          </h1>

          <p className="mx-auto max-w-xl font-body text-base sm:text-lg leading-relaxed text-muted-foreground">
            Describe your idea. AI handles the rest — design, components, build, and deploy. No code required.
          </p>

          <div className="flex justify-center gap-3 pt-2">
            <Link href="/build-studio" className="defi-button px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]">
              Start Building <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/projects" className="defi-button-outline px-8 py-3.5 text-sm font-medium">
              My Projects
            </Link>
          </div>
        </div>

        <HeroVisual />

        <div className="mt-14 sm:mt-20 flex justify-center gap-10 sm:gap-16 border-t border-white/6 pt-8">
          {[
            { value: "~90s", label: "To generate" },
            { value: "7+", label: "Parallel agents" },
            { value: "Auto", label: "Build repair" },
            { value: "0", label: "Lines of code" },
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From prompt to live site in 6 steps</h2>
          <p className="mt-3 font-body text-sm text-muted-foreground">Every generation runs through a structured AI pipeline — consistent, reliable, production-ready.</p>
        </div>
        <AgentFlowDemo steps={AGENT_STEPS} />
      </section>

      {/* ── Feature cards ── */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              tag: "Structured Pipeline",
              title: "Not a chatbot. An engineering system.",
              body: "A fixed 6-step pipeline with defined inputs and outputs — no AI drift, no surprises.",
              border: "border-primary/30 hover:border-primary/60",
              label: "text-primary",
            },
            {
              tag: "Smart Dispatch",
              title: "Component-level AI routing",
              body: "Each component type gets the right generation strategy — hero, form, dashboard, all handled differently.",
              border: "border-accent-tertiary/25 hover:border-accent-tertiary/55",
              label: "text-accent-tertiary",
            },
            {
              tag: "Auto Repair",
              title: "Build failed? AI fixes it.",
              body: "Post-generation build validation with up to 2 auto-repair rounds. If it can't fix it, it tells you why.",
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
