import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
  Zap,
} from "lucide-react";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Secure Flow Engine",
    description: "固定主流程，避免开放式 agent 污染产线逻辑。",
  },
  {
    icon: Cpu,
    title: "Bounded Planning",
    description: "先收敛结构与规则，让输出更像可控系统。",
  },
  {
    icon: Zap,
    title: "Controlled Repair",
    description: "失败进入受控 repair，限定修复范围。",
  },
];

export default function Home() {
  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_20%_20%,rgba(247,147,26,0.16),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(255,214,0,0.12),transparent_26%),radial-gradient(circle_at_50%_0%,rgba(234,88,12,0.12),transparent_34%)]" />

      <header className="relative z-10 border-b border-white/8 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="defi-badge px-3 py-1 text-[11px] text-foreground">OPEN-OX</div>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Bitcoin DeFi Build Interface
            </div>
          </div>
          <Link
            href="/build-studio"
            className="defi-button px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase sm:px-5"
          >
            Enter Build Studio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="absolute inset-x-6 top-6 -z-10 h-[420px] bg-grid-pattern opacity-60 lg:inset-x-8" />

        <div className="relative flex min-h-[calc(100vh-76px-80px)] flex-col justify-center gap-10">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-3">
              <span className="defi-badge px-3 py-1 text-[11px] text-primary">Bitcoin DeFi Aesthetic</span>
              <span className="defi-badge px-3 py-1 text-[11px] text-accent-tertiary gold-glow">
                Trusted Orange Rail
              </span>
            </div>

            <p className="font-mono text-xs uppercase tracking-[0.34em] text-primary">
              Secure. Technical. Valuable.
            </p>

            <h1 className="max-w-5xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Build AI websites through a{" "}
              <span className="bitcoin-gradient-text">trusted orange rail</span>.
            </h1>

            <p className="max-w-2xl font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
              首页只做一个入口：把用户稳定导向 `build-studio`，用受控流程替代开放式 agent 的随机拼装。
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/build-studio"
              className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
            >
              Open Build Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#highlights"
              className="defi-button-outline px-6 py-3 text-sm font-medium"
            >
              What you get
            </Link>
          </div>

          <div id="highlights" className="grid gap-4 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="defi-panel group flex items-start gap-4 px-4 py-4 transition-all duration-300 hover:border-primary/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/35 bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    {title}
                  </div>
                  <p className="mt-1 line-clamp-2 font-body text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
