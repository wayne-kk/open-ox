import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  GitBranch,
  Layers,
  Zap,
  Eye,
  MessageSquare,
  Database,
  Palette,
  FileCode,
  LayoutTemplate,
  History,
  Plug,
  MousePointer2,
  Globe2,
} from "lucide-react";

const CARDS = [
  {
    icon: Cpu,
    href: "/docs/architecture",
    title: "系统架构",
    desc: "产品面（Workspace / Community / Studio）、API、数据流，以及从输入到预览的完整生命周期。",
    tag: "核心",
    accent: "primary",
  },
  {
    icon: GitBranch,
    href: "/docs/pipeline",
    title: "AI 生成流水线",
    desc: "从校验技能到构建验证的主路径编排 — analyze ∥ infer、plan → 设计系统、Chrome 两阶段、多页 Page Agent、最多 5 轮构建修复。",
    tag: "流水线",
    accent: "tertiary",
  },
  {
    icon: Globe2,
    href: "/docs/architecture#surfaces",
    title: "Workspace · Community",
    desc: "默认私有 Workspace；Publish Preview 上架社区静态发现；Allow Remix 为独立拷贝许可。",
    tag: "产品",
    accent: "primary",
  },
  {
    icon: MousePointer2,
    href: "/docs/design-mode",
    title: "Design Mode",
    desc: "Preview 点选 → 源坐标定位 → 服务端 AST Direct Apply；失败时预填 Modify 草稿。",
    tag: "Studio",
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
    desc: "当前由每页 page_implement_agent 工具闭环落地路由与组件；Hero 可选运行时 skill 发现；Architect 先定稿 layout/chrome。",
    tag: "生成",
    accent: "tertiary",
  },
  {
    icon: Zap,
    href: "/docs/skills",
    title: "风格技能",
    desc: "用户 /skill 注入 styleGuide；Style Reference 设计系统 LLM 生成；Hero 区运行时组件 skill 发现（菜单与正文分离）。",
    tag: "设计",
    accent: "primary",
  },
  {
    icon: MessageSquare,
    href: "/docs/modify-agent",
    title: "修改 Agent",
    desc: "Intent 路由 + Agent 循环；工作记忆投影稳住短程续写；Stop Hook、图片输入与 /clear。",
    tag: "Agent",
    accent: "tertiary",
  },
  {
    icon: Eye,
    href: "/docs/preview",
    title: "预览沙箱",
    desc: "三种后端：Storage 静态导出 + `/site-previews` 代理、本地每站点 next dev、或 E2B 沙箱（静态导出 + serve）。",
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
  { value: "8+", label: "核心流水线节点" },
  { value: "0", label: "用户需要写的代码" },
  { value: "5", label: "构建修复最多轮次" },
];

export default function DocsPage() {
  return (
    <div className="max-w-3xl">
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
        Open-OX Studio 是一个全栈 AI 建站引擎。用户用一句话（可附参考图）描述需求，系统完成需求分析、设计系统、
        并行实现、构建验证与预览；之后可在 Studio 对话修改或 Design Mode 点选微调。Workspace 默认私有，可发布到 Community。
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="font-mono text-xl font-bold text-primary">{m.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary mb-1">快速开始</p>
        <p className="text-[13px] text-muted-foreground">
          从{" "}
          <Link href="/docs/architecture" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
            系统架构
          </Link>{" "}
          了解产品面与全局设计，然后阅读{" "}
          <Link href="/docs/pipeline" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
            AI 生成流水线
          </Link>{" "}
          或{" "}
          <Link href="/docs/design-mode" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
            Design Mode
          </Link>
          。
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/changelog"
          className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">更新日志</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">至 v1.12：工作台、社区、Design Mode、工作记忆等。</p>
          </div>
        </Link>
        <Link
          href="/docs/api"
          className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-accent-tertiary/35 hover:bg-accent-tertiary/[0.04]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <Plug className="h-4 w-4 text-accent-tertiary" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-semibold text-foreground group-hover:text-accent-tertiary transition-colors">API 参考</p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">HTTP 路由速查：Workspace、Community、Design Mode、认证等。</p>
          </div>
        </Link>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {CARDS.map(({ icon: Icon, href, title, desc, tag, accent }) => (
          <Link
            key={href}
            href={href}
            className={`group relative rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${accent === "primary"
              ? "border-primary/15 bg-primary/[0.03] hover:border-primary/35 hover:bg-primary/6"
              : accent === "tertiary"
                ? "border-accent-tertiary/15 bg-accent-tertiary/[0.02] hover:border-accent-tertiary/35"
                : "border-border bg-card hover:border-border"
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

      <div className="mt-10 border-t border-border pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40 mb-4">// 技术栈</p>
        <div className="flex flex-wrap gap-2">
          {["Next.js 16", "React 19", "TypeScript", "Tailwind CSS v4", "Supabase", "Preview: Storage / local / E2B", "OpenAI-compatible API", "飞书 / Google / Linux.do OAuth"].map((t) => (
            <span key={t} className="rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-[11px] text-muted-foreground/70">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
