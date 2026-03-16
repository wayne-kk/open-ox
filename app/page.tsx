import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Blocks,
  ChartNoAxesCombined,
  Coins,
  Cpu,
  LockKeyhole,
  ShieldCheck,
  Zap,
} from "lucide-react";

const featureCards = [
  {
    icon: ShieldCheck,
    title: "Secure Flow Engine",
    description:
      "固定主 Flow 驱动建站，不让开放式 agent 逻辑污染核心产线，稳定性优先于花哨自治。",
  },
  {
    icon: Cpu,
    title: "Bounded Planning",
    description:
      "生成前先收敛页面结构、动效和规则，让结果更像精密系统输出，而不是随机拼装。",
  },
  {
    icon: Zap,
    title: "Controlled Repair",
    description:
      "构建失败只进入受控 repair 分支，限定修复范围，避免无限反复地自发散。",
  },
];

const telemetry = [
  { label: "Main Flow", value: "8 Steps" },
  { label: "Trust Layer", value: "Fixed + Verifiable" },
  { label: "Primary Route", value: "/build-studio" },
  { label: "Status", value: "Production-minded" },
];

const flowSteps = [
  "analyze_project_requirement",
  "plan_project",
  "generate_project_design_system",
  "apply_project_design_tokens",
  "generate_section",
  "compose_page",
  "compose_layout",
  "run_build",
  "repair_build if needed",
];

const trustSignals = [
  "Bitcoin-orange primary action hierarchy",
  "Glass panels with grid-backed depth",
  "Colored glow shadows instead of black elevation",
  "Monospace telemetry for system credibility",
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

      <section className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] lg:px-8 lg:py-24">
        <div className="absolute inset-x-6 top-10 -z-10 h-[520px] bg-grid-pattern opacity-70 lg:inset-x-8" />

        <div className="relative z-10 flex flex-col justify-center gap-8">
          <div className="flex flex-wrap gap-3">
            <span className="defi-badge px-3 py-1 text-[11px] text-primary">Bitcoin DeFi Aesthetic</span>
            <span className="defi-badge px-3 py-1 text-[11px] text-accent-tertiary gold-glow">
              Premium Trust Layer
            </span>
          </div>

          <div className="space-y-6">
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-primary">
              Secure. Technical. Valuable.
            </p>
            <h1 className="max-w-5xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Build AI websites through a{" "}
              <span className="bitcoin-gradient-text">trusted orange rail</span>.
            </h1>
            <p className="max-w-2xl font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
              首页现在应该更像一个高可信的 DeFi 产品入口，而不是带攻击性的朋克实验页。
              视觉重点变成橙金光感、玻璃深度、网格纹理和工程化信息层级，主目标仍然是把用户稳定导向 `build-studio`。
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/build-studio"
              className="defi-button px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
            >
              Open Build Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#flow"
              className="defi-button-outline px-6 py-3 text-sm font-medium"
            >
              View Flow Blueprint
              <ChartNoAxesCombined className="h-4 w-4 text-primary" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {telemetry.map((item, index) => (
              <div
                key={item.label}
                className={`defi-panel px-4 py-4 transition-all duration-300 ${
                  index === 1 ? "md:-translate-y-2" : ""
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="relative hidden lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 m-auto h-[420px] w-[420px] rounded-full bg-primary/12 blur-[120px]" />
          <div className="relative flex h-[460px] w-full max-w-[520px] items-center justify-center">
            <div className="animate-float absolute h-[320px] w-[320px] rounded-full border border-white/10 bg-white/4 backdrop-blur-md" />
            <div className="absolute h-[380px] w-[380px] rounded-full border border-primary/40 orange-glow animate-[spin_10s_linear_infinite]" />
            <div className="absolute h-[270px] w-[270px] rounded-full border border-accent-tertiary/35 gold-glow animate-[spin_14s_linear_infinite_reverse]" />
            <div className="defi-glass relative z-10 w-[220px] rounded-full px-8 py-12 text-center">
              <Coins className="mx-auto h-10 w-10 text-primary" />
              <div className="mt-4 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                build rail
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">BTC</div>
              <div className="mt-3 text-sm leading-7 text-muted-foreground">
                Fixed flow. Bounded planning. Controlled repair.
              </div>
            </div>

            <div className="defi-glass animate-pulse-glow absolute left-0 top-8 w-44 p-4">
              <div className="mb-2 flex items-center gap-2">
                <BadgeDollarSign className="h-4 w-4 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  primary route
                </span>
              </div>
              <div className="text-lg font-semibold text-foreground">/build-studio</div>
            </div>

            <div className="defi-glass absolute right-2 top-14 w-40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-accent-tertiary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  trust signal
                </span>
              </div>
              <div className="text-sm leading-6 text-foreground">Stable build pipeline</div>
            </div>

            <div className="defi-glass absolute bottom-10 right-8 w-48 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ChartNoAxesCombined className="h-4 w-4 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  telemetry
                </span>
              </div>
              <div className="text-sm leading-6 text-foreground">Step-by-step live console</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-8 lg:px-8 lg:pb-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map(({ icon: Icon, title, description }) => (
            <div key={title} className="group defi-panel overflow-hidden p-8 transition-all duration-300">
              <div className="absolute -right-6 -top-6 opacity-10 transition-opacity duration-300 group-hover:opacity-25">
                <Icon className="h-28 w-28 text-primary" />
              </div>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/35 bg-primary/12 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
              <p className="mt-4 font-body text-sm leading-7 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-primary">
              Flow Blueprint
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              The pipeline stays precise while the interface feels premium.
            </h2>
          </div>
          <div className="hidden font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground lg:block">
            no vague agent shell, no generic dashboard skin
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="defi-panel overflow-hidden p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Blocks className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">
                Site generation chain
              </h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {flowSteps.map((step, index) => (
                <div
                  key={step}
                  className={`relative rounded-2xl border border-white/10 bg-black/20 px-5 py-5 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-10px_rgba(247,147,26,0.2)] ${
                    index % 3 === 1 ? "md:-translate-y-2" : ""
                  }`}
                >
                  <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-2xl border-l border-t border-primary/70" />
                  <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-2xl border-b border-r border-primary/70" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Step {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-3 font-mono text-sm text-foreground">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="defi-glass p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Coins className="h-5 w-5 text-accent-tertiary" />
              <h3 className="text-xl font-semibold text-foreground">
                Trust through design
              </h3>
            </div>
            <div className="space-y-4">
              {trustSignals.map((signal) => (
                <div
                  key={signal}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4"
                >
                  <span className="mt-1 flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_14px_rgba(247,147,26,0.7)]" />
                  <p className="font-body text-sm leading-7 text-muted-foreground">{signal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="defi-panel relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(247,147,26,0.2),transparent_62%)] lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.34em] text-primary">
                Primary Entry
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Build Studio is the canonical entrance for AI website generation.
              </h2>
              <p className="mt-4 max-w-2xl font-body text-base leading-8 text-muted-foreground">
                如果目标是执行真实建站链路，而不是浏览旧调试残留，现在就应该从
                `build-studio` 进入。
              </p>
            </div>
            <Link
              href="/build-studio"
              className="defi-button w-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] sm:w-auto"
            >
              Jump to Build Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
