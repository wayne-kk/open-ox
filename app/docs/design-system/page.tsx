import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-white/8 bg-[#080a0d] px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">
      {children}
    </pre>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight border-b border-white/8 pb-3">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-[15px] font-semibold text-foreground/90">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-7 text-muted-foreground">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/6 border border-white/8 px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">
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
          // docs / design-system
        </p>
        <h1 className="text-3xl font-bold tracking-tight">设计系统生成</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          每个项目都有一套 AI 生成的设计系统。它不是模板，而是根据用户 prompt 的语义
          推导出的颜色、字体、间距和动效规范 — 并以 CSS 变量的形式注入整个站点。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            设计系统生成分两步：先生成 <Code>design-system.md</Code>（人类可读的规范文档），
            再将其转化为 <Code>globals.css</Code> 中的 Tailwind v4 CSS 变量。
            后续所有 section 生成时都会读取这两个文件作为上下文。
          </P>
          <Pre>{`// 流水线中的位置
step 03: plan_project          ─┐ 并行
step 04: generate_design_system ─┘
step 05: apply_design_tokens   ← 读取 design-system.md → 写入 globals.css（与 step 06 并行）
step 06: generate_section ×N   ← 每次都注入 design-system.md + globals.css（与 step 05 并行）`}</Pre>
          <Callout>
            步骤 03 和 04 并行执行。设计系统不依赖规划结果，两者都只需要
            <Code>ProjectBlueprint</Code> 作为输入。
          </Callout>
        </section>

        <section id="generation" className="scroll-mt-24">
          <H2>生成流程</H2>
          <P>
            <Code>generate_project_design_system</Code> 步骤接收 Blueprint 的
            <Code>experience.designIntent</Code> 字段作为核心输入：
          </P>
          <Pre>{`// experience.designIntent 示例
{
  mood: ["energetic", "trustworthy"],
  colorDirection: "dark background with electric blue accent",
  style: "modern SaaS",
  keywords: ["performance", "developer-first", "minimal"]
}`}</Pre>
          <P>LLM 根据这些语义信号生成完整的 <Code>design-system.md</Code>，包含：</P>
          <div className="mt-4 space-y-2">
            {[
              { section: "Color System", desc: "primary / secondary / accent / background / surface / border / text 的完整色板，含 hex 值和使用场景" },
              { section: "Typography", desc: "heading / body / mono 字体族，字号阶梯（xs → 5xl），行高和字重规范" },
              { section: "Spacing & Layout", desc: "section-gap / container-padding / component-gap 等间距变量，最大宽度约束" },
              { section: "Component Style", desc: "按钮、卡片、输入框的圆角、阴影、边框风格指导" },
              { section: "Motion", desc: "过渡时长（fast / normal / slow）、缓动函数、动画类型偏好" },
            ].map(({ section, desc }) => (
              <div key={section} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
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
          <Pre>{`/* globals.css — Tailwind v4 @theme block */
@theme inline {
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;
  --color-background: #0a0a0f;
  --color-surface: #111118;
  --color-border: rgba(255,255,255,0.08);

  --font-heading: "Space Grotesk", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --spacing-section: 6rem;
  --spacing-container: 1.5rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;

  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}`}</Pre>
          <H3>增量写入策略</H3>
          <P>
            步骤不会覆盖整个 <Code>globals.css</Code>，而是提取现有的 <Code>@theme</Code> 块，
            与新生成的 token 合并后写回。这样可以保留用户手动添加的自定义样式。
          </P>
          <Callout type="warn">
            如果 LLM 生成的 token 名称与 Tailwind 内置变量冲突（如 <Code>--color-red-500</Code>），
            会优先使用生成的值。建议使用语义化命名（<Code>--color-primary</Code>）而非色阶命名。
          </Callout>
        </section>

        <section id="propagation" className="scroll-mt-24">
          <H2>向下传播</H2>
          <P>
            设计系统通过两个渠道传播给每个 section 生成步骤：
          </P>
          <Pre>{`// section 生成的 user message 结构
user message =
  design-system.md (完整内容)   ← 人类可读规范
  + globals.css (前 1000 字符)  ← 实际 CSS 变量
  + project context
  + section spec`}</Pre>
          <P>
            LLM 在生成 TSX 时会参考 <Code>design-system.md</Code> 中的颜色名称和间距规范，
            并直接使用 <Code>globals.css</Code> 中定义的 CSS 变量（如 <Code>text-primary</Code>、
            <Code>bg-surface</Code>）。这确保了所有 section 的视觉一致性。
          </P>
          <H3>修改时的一致性</H3>
          <P>
            修改 Agent 在启动时也会读取 <Code>design-system.md</Code> 作为上下文的一部分。
            当用户说"把按钮颜色改成品牌色"时，Agent 知道"品牌色"对应的是
            <Code>--color-primary</Code>，而不是一个硬编码的 hex 值。
          </P>
        </section>

        <section id="skill-override" className="scroll-mt-24">
          <H2>Skill 覆盖</H2>
          <P>
            用户在 prompt 中输入 <Code>/minimal</Code>、<Code>/bold</Code> 等命令时，
            skill 内容会作为 <Code>styleGuide</Code> 注入 <Code>generate_project_design_system</Code> 步骤：
          </P>
          <Pre>{`// styleGuide 注入（截断到 1200 字符）
const systemPrompt = [
  basePrompt,
  styleGuide
    ? \`\n\n## Style Guide Override\n\${styleGuide.slice(0, 1200)}\`
    : "",
].join("");`}</Pre>
          <P>
            Skill 的视觉方向会影响设计系统的生成结果。例如 <Code>/glassmorphism</Code> 会让
            LLM 生成半透明背景色和毛玻璃效果相关的 CSS 变量，而 <Code>/brutalist</Code> 会
            生成高对比度、无圆角的 token 组合。
          </P>
          <div className="mt-4 space-y-2">
            {[
              { skill: "/minimal", effect: "大量留白，单色调，--radius-* 趋近于 0，--spacing-section 增大" },
              { skill: "/bold", effect: "高对比度，--color-primary 饱和度高，--font-heading 字重 800+" },
              { skill: "/glassmorphism", effect: "半透明 --color-surface，backdrop-blur 相关变量，柔和阴影" },
              { skill: "/brutalist", effect: "强边框，--radius-* 为 0，黑白高对比，等宽字体主导" },
            ].map(({ skill, effect }) => (
              <div key={skill} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <code className="shrink-0 font-mono text-[12px] text-primary/80 w-28">{skill}</code>
                <span className="text-[12px] text-muted-foreground/70">{effect}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
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
