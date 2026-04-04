import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

function Pre({ children }: { children: React.ReactNode }) {
  return <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-white/8 bg-[#080a0d] px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">{children}</pre>;
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
  return <code className="rounded bg-white/6 border border-white/8 px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">{children}</code>;
}
function Callout({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`my-4 rounded-xl border px-5 py-4 text-[13px] leading-6 ${type === "warn" ? "border-accent-tertiary/20 bg-accent-tertiary/5 text-accent-tertiary/90" : "border-primary/20 bg-primary/5 text-muted-foreground"}`}>
      {children}
    </div>
  );
}

const SKILLS = [
  { id: "minimal", name: "极简", desc: "大量留白，单色调，字体主导。瑞士设计、Dieter Rams 风格。", accent: "text-muted-foreground" },
  { id: "bold", name: "大胆", desc: "高对比度，超大字体，强烈色彩分区。Stripe、Linear 营销页风格。", accent: "text-primary" },
  { id: "glassmorphism", name: "玻璃拟态", desc: "毛玻璃效果，半透明层次，纵深感。macOS Big Sur、iOS 小组件风格。", accent: "text-blue-400" },
  { id: "brutalist", name: "野兽派", desc: "原始网格，强烈对比，反精致。实验性排版，粗犷边框。", accent: "text-amber-400" },
];

const TOC = [
  { id: "overview", label: "概览" },
  { id: "available", label: "可用技能" },
  { id: "injection", label: "注入流程" },
  { id: "preselect", label: "批量预选" },
  { id: "custom", label: "自定义技能" },
];

export default function SkillsPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">// docs / skills</p>
        <h1 className="text-3xl font-bold tracking-tight">风格技能</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          风格技能（Style Skills）让用户在生成前注入视觉风格指南。
          每个技能是一个 Markdown 文件，描述色彩哲学、字体规则和组件风格。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            技能文件存放在 <Code>public/skills/</Code> 目录下。用户在首页 prompt 输入框中
            输入 <Code>/</Code> 触发技能菜单，选择后技能内容会被注入生成流程。
          </P>
          <Pre>{`public/skills/
├── minimal.md       # 极简风格
├── bold.md          # 大胆风格
├── glassmorphism.md # 玻璃拟态
└── brutalist.md     # 野兽派`}</Pre>
          <P>
            每个文件是纯 Markdown，包含三个部分：视觉方向（Visual Direction）、
            组件风格（Component Style）、色调描述（Tone）。
          </P>
        </section>

        <section id="available" className="scroll-mt-24">
          <H2>可用技能</H2>
          <div className="mt-4 space-y-3">
            {SKILLS.map(({ id, name, desc, accent }) => (
              <div key={id} className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
                <div className="flex items-center gap-3">
                  <code className={`font-mono text-[13px] font-semibold ${accent}`}>/{id}</code>
                  <span className="text-[13px] font-semibold text-foreground/90">{name}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground/70">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="injection" className="scroll-mt-24">
          <H2>注入流程</H2>
          <P>从用户选择到实际生效的完整链路：</P>
          <Pre>{`1. 用户在 HeroPrompt 输入 /minimal
2. useSlashMenu 弹出技能菜单
3. 选择后 → fetch /skills/minimal.md 获取完整内容
4. 显示 badge："/minimal style applied"
5. 提交时：
   POST /api/projects { userPrompt: "...", styleGuide: "# Minimal Style..." }
6. 服务端返回 projectId + styleGuide
7. 前端存入 sessionStorage["styleGuide:{projectId}"]
8. handleRun() 读取 sessionStorage，传给 /api/ai
9. /api/ai 传给 runGenerateProject({ styleGuide })
10. styleGuide 仅注入 generateProjectDesignSystem 步骤
    （截断到 1200 字符）`}</Pre>
          <Callout type="warn">
            styleGuide 不会注入 <Code>analyzeProjectRequirement</Code> 步骤。
            完整 skill 文档 + 用户 prompt 会导致该步骤的 prompt 过大，触发 LLM 超时（实际发生过）。
          </Callout>
        </section>

        <section id="preselect" className="scroll-mt-24">
          <H2>批量预选</H2>
          <P>
            除了用户手动注入的 styleGuide，系统还有一套内部的 skill 预选机制。
            <Code>preselect_skills</Code> 步骤为每个 section 从候选列表中选择最合适的组件级 skill。
          </P>
          <H3>菜单与菜谱分离</H3>
          <Pre>{`// 选择阶段 — 只传 metadata（菜单）
sections: [{
  fileName: "HeroSection",
  type: "hero",
  intent: "...",
  candidates: [{ id: "component.hero.impactful", notes: "..." }]
}]

// 生成阶段 — 加载完整 prompt（菜谱）
const skillPrompt = loadSkillPrompt(skillId);`}</Pre>
          <P>
            这个设计大幅减少了选择阶段的 token 消耗。对于 8 个 section 的项目，
            原来需要 8 次串行 LLM 调用（每次 ~2s），现在合并为 1 次（~3s）。
          </P>
        </section>

        <section id="custom" className="scroll-mt-24">
          <H2>自定义技能</H2>
          <P>
            添加新技能只需在 <Code>public/skills/</Code> 下创建一个 Markdown 文件。
            文件名即为技能 ID，会自动出现在 <Code>/api/skills</Code> 列表和前端菜单中。
          </P>
          <Pre>{`# My Custom Style

## Visual Direction
- 描述你的视觉方向...

## Component Style
- 描述组件风格...

## Tone
描述整体调性...`}</Pre>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/blueprint" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 项目蓝图
          </Link>
          <Link href="/docs/modify-agent" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            修改 Agent <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </article>
      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">本页目录</p>
          <ul className="space-y-1">
            {TOC.map((item) => (
              <li key={item.id}><a href={`#${item.id}`} className="block text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors py-0.5">{item.label}</a></li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
