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
  return <code className="rounded bg-white/6 border border-white/8 px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">{children}</code>;
}
function Callout({ children }: { children: React.ReactNode }) {
  return <div className="my-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-[13px] leading-6 text-muted-foreground">{children}</div>;
}

const TOC = [
  { id: "structure", label: "整体结构" },
  { id: "brief", label: "Brief 层" },
  { id: "experience", label: "Experience 层" },
  { id: "site", label: "Site 层" },
  { id: "normalize", label: "容错 Normalize" },
];

export default function BlueprintPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">// docs / blueprint</p>
        <h1 className="text-3xl font-bold tracking-tight">项目蓝图</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          <Code>ProjectBlueprint</Code> 是整个系统的核心数据结构。用户的一句话 prompt 经过
          <Code>analyze_project_requirement</Code> 步骤后，被转化为这个结构化的蓝图，
          后续所有步骤都以它为输入。
        </p>

        <section id="structure" className="scroll-mt-24">
          <H2>整体结构</H2>
          <P>Blueprint 由三个顶层模块组成：</P>
          <Pre>{`ProjectBlueprint {
  brief       → 产品定义（做什么、给谁用、核心能力）
  experience  → 设计意图（视觉风格、色彩方向、关键词）
  site        → 站点蓝图（信息架构、页面列表、section 规格）
}`}</Pre>
        </section>

        <section id="brief" className="scroll-mt-24">
          <H2>Brief 层</H2>
          <P>定义产品的"是什么"和"给谁用"：</P>
          <Pre>{`ProjectBrief {
  projectTitle: string          // 项目标题
  projectDescription: string    // 项目描述
  language: "zh" | "en" | ...   // 决定所有生成内容的语言

  productScope: {
    productType: string         // "SaaS landing page"、"e-commerce" 等
    mvpDefinition: string       // MVP 定义
    coreOutcome: string         // 核心交付成果
    businessGoal: string        // 业务目标
    audienceSummary: string     // 目标受众
    inScope: string[]           // 范围内
    outOfScope: string[]        // 范围外
  }

  roles: UserRole[]             // 用户角色（访客、管理员等）
  taskLoops: TaskLoop[]         // 用户任务流程
  capabilities: CapabilitySpec[] // 产品能力（must-have / should-have / nice-to-have）
}`}</Pre>
          <H3>UserRole</H3>
          <P>
            每个角色有 <Code>roleId</Code>、<Code>goals</Code>、<Code>coreActions</Code>、
            <Code>permissions</Code> 和优先级（primary / secondary / supporting）。
            如果 LLM 没有输出角色，系统会自动创建一个默认的 "Visitor" 角色。
          </P>
          <H3>TaskLoop</H3>
          <P>
            描述用户的端到端旅程：入口触发 → 步骤序列 → 成功状态。
            每个 TaskLoop 关联到一个 Role 和若干 Capability。
          </P>
        </section>

        <section id="experience" className="scroll-mt-24">
          <H2>Experience 层</H2>
          <P>定义视觉和情感方向：</P>
          <Pre>{`ProjectExperience {
  designIntent: {
    mood: string[]           // ["energetic", "professional"]
    colorDirection: string   // "dark with orange accent"
    style: string            // "modern minimalist"
    keywords: string[]       // 传递给后续所有生成步骤
  }
}`}</Pre>
          <P>
            <Code>keywords</Code> 数组特别重要 — 它会被传递给 <Code>preselect_skills</Code> 步骤，
            影响每个 section 的风格技能选择。
          </P>
        </section>

        <section id="site" className="scroll-mt-24">
          <H2>Site 层</H2>
          <P>定义站点的具体结构：</P>
          <Pre>{`ProjectSiteBlueprint {
  informationArchitecture: {
    navigationModel: string    // 导航模型描述
    pageMap: PageMapEntry[]    // 页面地图
    sharedShells: string[]     // 共享外壳（"全局导航"、"全局页脚"）
    notes: string[]
  }

  layoutSections: SectionSpec[]  // nav、footer 等共享组件
  pages: PageBlueprint[]         // 每个页面及其 sections
}`}</Pre>
          <H3>SectionSpec</H3>
          <P>每个 section 的规格：</P>
          <Pre>{`SectionSpec {
  type: string                    // "hero"、"features"、"pricing" 等
  intent: string                  // 这个 section 要传达什么
  contentHints: string            // 内容提示
  fileName: string                // 输出文件名（如 "HeroSection"）
  primaryRoleIds: string[]        // 主要服务的角色
  supportingCapabilityIds: string[] // 关联的产品能力
  sourceTaskLoopIds: string[]     // 关联的任务流
}`}</Pre>
          <Callout>
            <Code>fileName</Code> 会被转为 PascalCase 并加上 scope 前缀，
            最终生成如 <Code>home_HeroSection.tsx</Code>、<Code>layout_NavSection.tsx</Code> 的文件。
          </Callout>
        </section>

        <section id="normalize" className="scroll-mt-24">
          <H2>容错 Normalize</H2>
          <P>
            LLM 输出 JSON 时经常出现字段缺失、类型错误、结构不一致。
            <Code>asProjectBlueprint()</Code> 函数支持三种输出格式并对每个字段做 normalize：
          </P>
          <div className="mt-4 space-y-2">
            {[
              { format: "嵌套结构", desc: "标准的 { brief, experience, site } 三层嵌套" },
              { format: "扁平结构", desc: "所有字段平铺在顶层（projectTitle、designIntent、pages 等）" },
              { format: "单页结构", desc: "只有 title、description、sections — 自动包装为单页项目" },
            ].map(({ format, desc }) => (
              <div key={format} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <code className="shrink-0 font-mono text-[11px] text-primary/80 w-24">{format}</code>
                <span className="text-[12px] text-muted-foreground/70">{desc}</span>
              </div>
            ))}
          </div>
          <P>
            每个字段都有合理的 fallback 值。例如 <Code>roles</Code> 为空时自动创建默认 Visitor 角色，
            <Code>productScope</Code> 缺失时从 <Code>projectDescription</Code> 推导。
            这比在 prompt 中反复强调"必须输出完整 JSON"更可靠。
          </P>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/pipeline" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> AI 生成流水线
          </Link>
          <Link href="/docs/skills" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            风格技能 <ArrowRight className="h-3.5 w-3.5" />
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
