import Link from "next/link";
import { ArrowRight, Cpu, GitBranch, Layers, Zap, Eye, MessageSquare, Database, Palette, FileCode, LayoutTemplate, History, Plug } from "lucide-react";

const CARDS = [
  {
    icon: Cpu,
    href: "/docs/architecture",
    title: "系统架构",
    desc: "系统全景、API 路由、数据流，以及从用户输入到上线预览的完整项目生命周期。",
    tag: "核心",
    accent: "primary",
  },
  {
    icon: GitBranch,
    href: "/docs/pipeline",
    title: "AI 生成流水线",
    desc: "13 步编排（8 个核心生成节点）— 并行执行、运行时 Skill 发现、构建自动修复。",
    tag: "流水线",
    accent: "tertiary",
  },
  {
    icon: Layers,
    href: "/docs/blueprint",
    title: "项目蓝图",
    desc: "一句话 prompt 如何变成结构化的 ProjectBlueprint：角色、页面、设计意图。",
    tag: "数据模型",
    accent: "muted",
  },
  {
    icon: FileCode,
    href: "/docs/normalize",
    title: "Blueprint 容错解析",
    desc: "三种输出格式兼容、字段级 normalize、Web Search 工具、Fallback 策略。",
    tag: "容错",
    accent: "tertiary",
  },
  {
    icon: Palette,
    href: "/docs/design-system",
    title: "设计系统生成",
    desc: "AI 生成颜色、字体、间距、动效规范，转化为 Tailwind v4 CSS 变量并传播给所有 section。",
    tag: "设计",
    accent: "primary",
  },
  {
    icon: LayoutTemplate,
    href: "/docs/section-generation",
    title: "Section 生成",
    desc: "从 PlannedSectionSpec 到单文件 TSX：Prompt 分层、Skill 预选、并行批次与静态验证重试。",
    tag: "生成",
    accent: "tertiary",
  },
  {
    icon: Zap,
    href: "/docs/skills",
    title: "风格技能",
    desc: "/minimal、/bold、/glassmorphism 技能系统 — 菜单与菜谱分离模式。",
    tag: "设计",
    accent: "primary",
  },
  {
    icon: MessageSquare,
    href: "/docs/modify-agent",
    title: "修改 Agent",
    desc: "受 Claude Code 启发的 Agent 循环，配备 Stop Hook、对话记忆和图片输入。",
    tag: "Agent",
    accent: "tertiary",
  },
  {
    icon: Eye,
    href: "/docs/preview",
    title: "预览沙箱",
    desc: "E2B 云端沙箱、静态导出策略、沙箱重连与增量重建优化。",
    tag: "基础设施",
    accent: "muted",
  },
  {
    icon: Database,
    href: "/docs/storage",
    title: "存储与持久化",
    desc: "双层存储架构：Supabase DB 保存元数据，Storage 保存源文件，本地 sites/ 作为工作区。",
    tag: "基础设施",
    accent: "muted",
  },
];

const METRICS = [
  { value: "~90s", label: "端到端生成时间" },
  { value: "8", label: "核心流水线节点" },
  { value: "0", label: "用户需要写的代码" },
  { value: "2", label: "最大自动修复轮次" },
];

export default function DocsPage() {
  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-6">
        // docs
      </p>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Open-OX Studio
        <span className="block text-lg font-normal text-muted-foreground mt-2">
          技术文档
        </span>
      </h1>

      <p className="mt-5 text-[15px] leading-7 text-muted-foreground max-w-2xl">
        Open-OX Studio 是一个全栈 AI 建站引擎。用户只需一句话描述需求，系统自动完成需求分析、设计系统生成、
        并行组件编写、构建验证和云端预览。全程零代码。
      </p>

      {/* Metrics strip */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <div className="font-mono text-xl font-bold text-primary">{m.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Quick start callout */}
      <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary mb-1">快速开始</p>
        <p className="text-[13px] text-muted-foreground">
          从{" "}
          <Link href="/docs/architecture" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
            系统架构
          </Link>{" "}
          了解全局设计，然后阅读{" "}
          <Link href="/docs/pipeline" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
            AI 生成流水线
          </Link>{" "}
          深入生成流程细节。
        </p>
      </div>

      {/* Changelog + API */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/changelog"
          className="group flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">更新日志</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">版本迭代、工程决策与能力变更时间线。</p>
          </div>
        </Link>
        <Link
          href="/docs/api"
          className="group flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-accent-tertiary/35 hover:bg-accent-tertiary/[0.04]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Plug className="h-4 w-4 text-accent-tertiary" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-semibold text-foreground group-hover:text-accent-tertiary transition-colors">API 参考</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">HTTP 路由速查：项目、生成、预览、认证等。</p>
          </div>
        </Link>
      </div>

      {/* Cards grid */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {CARDS.map(({ icon: Icon, href, title, desc, tag, accent }) => (
          <Link
            key={href}
            href={href}
            className={`group relative rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${accent === "primary"
              ? "border-primary/15 bg-primary/[0.03] hover:border-primary/35 hover:bg-primary/6"
              : accent === "tertiary"
                ? "border-accent-tertiary/15 bg-accent-tertiary/[0.02] hover:border-accent-tertiary/35"
                : "border-white/8 bg-white/[0.02] hover:border-white/18"
              }`}
          >
            <div className="flex items-start justify-between">
              <Icon className={`h-4 w-4 mt-0.5 ${accent === "primary" ? "text-primary" : accent === "tertiary" ? "text-accent-tertiary" : "text-muted-foreground"}`} />
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">{tag}</span>
            </div>
            <h3 className="mt-3 font-heading text-[15px] font-semibold">{title}</h3>
            <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{desc}</p>
            <div className={`mt-3 flex items-center gap-1 text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${accent === "primary" ? "text-primary" : accent === "tertiary" ? "text-accent-tertiary" : "text-muted-foreground"}`}>
              阅读更多 <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>

      {/* Stack note */}
      <div className="mt-10 border-t border-white/8 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40 mb-4">// 技术栈</p>
        <div className="flex flex-wrap gap-2">
          {["Next.js 15", "TypeScript", "Tailwind CSS v4", "Supabase", "E2B Sandboxes", "OpenAI-compatible API"].map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-muted-foreground/70">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
