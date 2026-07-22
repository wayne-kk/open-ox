import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-border bg-muted px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">
      {children}
    </pre>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight border-b border-border pb-3">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-[15px] font-semibold text-foreground/90">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-7 text-muted-foreground">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">
      {children}
    </code>
  );
}
function Callout({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`my-4 rounded-xl border px-5 py-4 text-[13px] leading-6 ${type === "warn"
      ? "border-accent-tertiary/20 bg-accent-tertiary/5 text-accent-tertiary/90"
      : "border-primary/20 bg-primary/5 text-muted-foreground"
      }`}>
      {children}
    </div>
  );
}

const TOC = [
  { id: "overview", label: "概览" },
  { id: "generation", label: "生成流程" },
  { id: "tokens", label: "Token 写入" },
  { id: "propagation", label: "向下传播" },
  { id: "skill-override", label: "Skill 覆盖" },
];

export default function DesignSystemPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          {"// docs / design-system"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">设计系统生成</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          每个项目都有一套经过解析的设计系统：高置信命中版本化 Skill 时直接复用，否则才由 AI
          根据用户语义生成。最终颜色、字体、间距和动效规范会以 CSS 变量注入整个站点。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            设计系统生成分两步：先生成 <Code>design-system.md</Code>（人类可读的规范文档），
            再将其转化为 <Code>globals.css</Code> 中的 Tailwind v4 CSS 变量。
            后续所有 section 生成时都会读取这两个文件作为上下文。
          </P>
          <Pre>{`// 主路径编排（与设计系统相关的部分）
analyze_project_requirement  ∥ infer_design_intent   // 第一层并行
plan_project ∥ resolve_design_system
  ├─ matched skill               // 跳过设计系统生成 LLM
  └─ fallback → LLM generation   // 无匹配时才执行
apply_project_design_tokens      // 先于一切页面写入
architect_scaffold_agent → page_implement_agent ×M → chrome_optimize_agent`}</Pre>
          <Callout>
            Skill 只有在契约通过且匹配足够明确时才会命中；低置信、歧义、显式冲突和截图复刻都会回退到 LLM 生成。
          </Callout>
        </section>

        <section id="generation" className="scroll-mt-24">
          <H2>生成流程</H2>
          <P>
            <Code>generate_project_design_system</Code> 的核心输入来自{" "}
            <Code>infer_design_intent</Code> 的自然语言摘要（若 analyze 已带{" "}
            <Code>experience.designIntent</Code> 亦可作为回退），并可叠加用户在前端选择的{" "}
            <Code>styleGuide</Code>（截断至 1200 字符）。
          </P>
          <Pre>{`// experience.designIntent 示例
{
  mood: ["energetic", "trustworthy"],
  colorDirection: "dark background with electric blue accent",
  style: "modern SaaS",
  keywords: ["performance", "developer-first", "minimal"]
}`}</Pre>
          <P>Resolver 返回的 Skill 或 LLM 结果都必须形成完整的 <Code>design-system.md</Code>（Style Reference 格式），包含：</P>
          <div className="mt-4 space-y-2">
            {[
              { section: "Tokens — Colors", desc: "语义化色板表格（Name / Value / Token / Role），含渐变与 accent 使用约束" },
              { section: "Tokens — Typography", desc: "字体族、字重、字距、Type Scale 表格与 CSS token" },
              { section: "Tokens — Spacing & Shapes", desc: "间距阶梯、圆角、阴影、布局密度与 max-width" },
              { section: "Components", desc: "6–12 个具名组件规格（Nav Button、Card、Input 等），含 hover/focus 状态" },
              { section: "Do's and Don'ts + Quick Start", desc: "可验证规则 + 可直接写入 globals.css 的 :root / @theme 块" },
            ].map(({ section, desc }) => (
              <div key={section} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <code className="shrink-0 font-mono text-[11px] text-primary/80 w-36">{section}</code>
                <span className="text-[12px] text-muted-foreground/70">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="tokens" className="scroll-mt-24">
          <H2>Token 写入</H2>
          <P>
            <Code>apply_project_design_tokens</Code> 步骤读取 <Code>design-system.md</Code>，
            提取已有的 <Code>globals.css</Code> 内容，然后写入 Tailwind v4 格式的 CSS 变量：
          </P>
          <Pre>{`/* globals.css — Tailwind v4 @theme block (semantic tokens) */
@theme inline {
  --color-parchment: #fcfbf8;
  --color-charcoal: #1c1c1c;
  --color-linen-border: #eceae4;

  --font-inter: "Inter", ui-sans-serif, system-ui, sans-serif;

  --text-body: 16px;
  --leading-body: 1.5;
  --tracking-body: -0.4px;

  --spacing-16: 16px;
  --radius-card: 16px;
  --shadow-subtle: oklch(0 0 0 / 0.25) 0px 0px 0px 0.5px inset;
}`}</Pre>
          <H3>整文件重写（保留结构意图）</H3>
          <P>
            模型会收到<strong>完整的设计系统 Markdown</strong>以及<strong>当前的{" "}
            <Code>app/globals.css</Code></strong>（过长会首尾截断）。输出应为<strong>完整的</strong>
            <Code>globals.css</Code>，而非局部补丁；提示词要求保留 import、基础层样式等模板结构。
          </P>
          <Callout type="warn">
            如果 LLM 生成的 token 名称与 Tailwind 内置变量冲突，会优先使用生成的值。颜色请用语义化命名（<Code>--color-parchment</Code>），不要用色阶名（<Code>--color-red-500</Code>）。
            <strong className="block mt-2">Spacing 特别注意：</strong>不要在 <Code>@theme</Code> 里写 <Code>--spacing-xl</Code>、<Code>--spacing-lg</Code> 等 —— Tailwind v4 会让 <Code>max-w-xl</Code> 变成 32px 级别的窄列。请用 <Code>--spacing-section</Code>、<Code>--spacing-gap-md</Code> 等语义名；组件行宽用 <Code>max-w-[36rem]</Code> 或 <Code>max-w-prose</Code>。
          </Callout>
        </section>

        <section id="propagation" className="scroll-mt-24">
          <H2>向下传播</H2>
          <P>
            设计系统通过两条只读快照传播给每个 <Code>page_implement_agent</Code>：
            完整的 <Code>design-system.md</Code>，以及在 Agent user 消息中附带的{" "}
            <Code>globals.css</Code> 全文（或截断说明）。Modify Agent 启动时同样读取 design-system，
            以便用户口头修改 token 时有单一事实来源。
          </P>
          <H3>修改时的一致性</H3>
          <P>
            修改 Agent 在启动时也会读取 <Code>design-system.md</Code> 作为上下文的一部分。
            当用户说「把按钮颜色改成品牌色」时，Agent 应查 Style Reference 中的 token 名称（如 <Code>--color-charcoal</Code>），而不是硬编码 hex。
          </P>
        </section>

        <section id="skill-override" className="scroll-mt-24">
          <H2>Skill 快路径</H2>
          <P>
            新请求可传递版本化 <Code>selectedDesignSystemSkill</Code>；契约有效时无需 matcher 和设计系统生成 LLM：
          </P>
          <Pre>{`selectedDesignSystemSkill: {
  id: "minimal-dark",
  version: "2"
}`}</Pre>
          <P>
            旧 <Code>styleGuide</Code> 正文仍兼容：它参与候选冲突判断，未命中时作为动态生成输入。
            自动匹配只检查 Top 3，并要求高置信、无冲突和足够的候选分差。截图复刻会跳过自动匹配，
            但用户显式选择的版本化 skill 仍然优先；全局 kill switch 关闭时则统一走动态生成。
          </P>
          <div className="mt-4 space-y-2">
            {[
              { skill: "minimal-dark", effect: "深色层次、克制琥珀焦点、开发工具与 SaaS" },
              { skill: "newsprint", effect: "报刊式排版、暖纸张、编辑密度与规则线" },
              { skill: "bauhaus", effect: "构成主义网格、原色几何与粗边框" },
              { skill: "neo-brutalism", effect: "粗描边、硬阴影、流行色与直接交互反馈" },
              { skill: "luxury", effect: "安静奢华、电影感媒体、编辑字体与大尺度留白" },
            ].map(({ skill, effect }) => (
              <div key={skill} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <code className="shrink-0 font-mono text-[12px] text-primary/80 w-28">{skill}</code>
                <span className="text-[12px] text-muted-foreground/70">{effect}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-between">
          <Link href="/docs/blueprint" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 项目蓝图
          </Link>
          <Link href="/docs/section-generation" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            Section 生成 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </article>

      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">本页目录</p>
          <ul className="space-y-1">
            {TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="block text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors py-0.5">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
