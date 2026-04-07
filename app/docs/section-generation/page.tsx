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
  { id: "upstream", label: "上游：规划与数据" },
  { id: "orchestration", label: "编排与并行" },
  { id: "prompt", label: "单次生成的 Prompt" },
  { id: "validation", label: "验证与重试" },
  { id: "downstream", label: "下游组装" },
];

export default function SectionGenerationPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          {"// docs / section-generation"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Section 生成</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          Section 是站点里可组合的最小 UI 单元：每个 section 对应一个 React 组件文件（例如{" "}
          <Code>HeroSection.tsx</Code>）。本文说明从蓝图中的规格到落盘 TSX 的实现路径，对应流水线中的{" "}
          <Code>generate_section</Code> 步骤。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            生成一条 section 的本质是：在已确定的<strong>设计系统</strong>、<strong>全局样式</strong>和<strong>项目语境</strong>下，
            让模型输出<strong>单个文件的完整 TSX</strong>，并写入站点目录。核心实现集中在{" "}
            <Code>ai/flows/generate_project/steps/generateSection.ts</Code> 中的{" "}
            <Code>stepGenerateSection</Code>。
          </P>
          <P>
            输入侧，每个 section 携带 <Code>type</Code>、<Code>intent</Code>、<Code>contentHints</Code>、
            关联角色 / 能力 / 任务流 ID，以及规划阶段写好的 <Code>designPlan</Code>（布局意图、视觉意图、交互意图、约束等）。
            若规划未写入 <Code>designPlan</Code>，会用 <Code>buildDefaultSectionDesignPlan</Code> 从项目语境推导一份默认值，避免生成步骤缺参。
          </P>
        </section>

        <section id="upstream" className="scroll-mt-24">
          <H2>上游：规划与数据</H2>
          <P>
            <Code>plan_project</Code>（提示词见 <Code>ai/flows/generate_project/prompts/steps/planProject.md</Code>）把「仅有页面、尚无 section」的蓝图，
            扩展为 <Code>PlannedProjectBlueprint</Code>：为每个页面推导 <Code>sections[]</Code>，并为每个 section 挂上{" "}
            <Code>designPlan</Code>。同时区分全局壳层与页面内容：
          </P>
          <ul className="mt-3 list-disc pl-5 text-[14px] leading-7 text-muted-foreground space-y-1">
            <li>
              <Code>layoutSections</Code> 只应包含全站共享壳（如 <Code>navigation</Code>、<Code>footer</Code>）。
            </li>
            <li>
              其余 hero、定价、FAQ 等必须落在各页的 <Code>pages[].sections</Code>。
            </li>
          </ul>
          <Callout>
            <Code>runGenerateProject</Code> 里有一段安全校正：若误把非布局类 section 放进{" "}
            <Code>layoutSections</Code>，会将其挪回首页（或第一页）的 <Code>sections</Code>，保证后续路径与文件布局一致。
          </Callout>
        </section>

        <section id="orchestration" className="scroll-mt-24">
          <H2>编排与并行</H2>
          <P>
            写入设计 Token（<Code>apply_project_design_tokens</Code>）与 section 生成现在并行执行。
            每个 section 在生成时自行发现并选择 skill（运行时 score-based fallback），不再有全局预选步骤。
          </P>
          <P>
            所有待生成的 section（含 layout 与各页）被收集为一批 <Code>SectionBatchItem</Code>，通过{" "}
            <Code>runSectionBatch</Code> 用 <Code>Promise.allSettled</Code> 并行调用 <Code>stepGenerateSection</Code>。
            任一项失败会在聚合后抛出汇总错误，便于日志与制品记录逐步名{" "}
            <Code>{"generate_section:{scope}:{fileName}"}</Code>。
          </P>
          <Pre>{`// runGenerateProject.ts — 并行生成一批 section
const results = await Promise.allSettled(
  items.map((item) =>
    stepGenerateSection({
      designSystem,
      projectGuardrailIds: runtimeContext.projectGuardrailIds,
      projectContext: runtimeContext,
      section: item.section,
      outputFileRelative: item.outputFileRelative,
      pageContext: item.pageContext,
      preselectedSkillId: item.preselectedSkillId,
    })
  )
);`}</Pre>
        </section>

        <section id="prompt" className="scroll-mt-24">
          <H2>单次生成的 Prompt</H2>
          <H3>System：分层拼接</H3>
          <P>
            <Code>buildSystemPrompt</Code> 按顺序拼接：前端基座（<Code>frontend.md</Code>）、
            section 通用规则（<Code>section.default.md</Code>）、按类型可选的 <Code>{"section.{type}.md"}</Code>（
            由 <Code>selectSectionPromptId</Code> 按约定文件名是否存在决定，无则回退 default）、
            选中技能的完整 Markdown、guardrail（项目级 + <Code>designPlan.guardrailIds</Code>）、
            能力增强片段（<Code>traits</Code>）、以及输出形态约束（<Code>outputTsx</Code>）。
            逐步骤对照表与 skill 预选细节见{" "}
            <Link href="/docs/generate-project-trace" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
              Prompt 拼装 Trace
            </Link>
            。
          </P>
          <H3>User：语境 + 任务</H3>
          <P>
            <Code>buildUserMessage</Code> 注入整份 <Code>design-system.md</Code>、当前 <Code>app/globals.css</Code>（并明确禁止重复定义其中已有类与 keyframes）、
            产品范围与语言（要求用户可见文案与项目语言一致）、按 section 过滤后的角色 / 任务流 / 能力列表、
            全站合法路由列表（导航只允许这些路径）、页面语境或「layout section」说明，以及 section 规格与完整{" "}
            <Code>designPlan</Code> 字段。最后要求生成完整的 <Code>{"{fileName}.tsx"}</Code>，并强调以 design plan 为准。
          </P>
        </section>

        <section id="validation" className="scroll-mt-24">
          <H2>验证与重试</H2>
          <P>
            模型返回后，<Code>extractContent(..., &quot;tsx&quot;)</Code> 抽出代码块，写入文件并执行 <Code>formatSiteFile</Code>。
            随后 <Code>validateSectionExports</Code> 做轻量静态检查（非 TypeScript 编译）：
          </P>
          <ul className="mt-3 list-disc pl-5 text-[14px] leading-7 text-muted-foreground space-y-1">
            <li>内容非空</li>
            <li>存在与组件名一致的 <Code>export function/const/class Name</Code>，或 <Code>export default</Code></li>
            <li><Code>return</Code> 后存在 JSX</li>
          </ul>
          <P>
            未通过时最多自动重试 1 次：在 system 侧追加截断/缺 export 的修复提示，并提醒控制体积以避免再次截断。
            仍失败则抛出错误，该 section 步骤记为 error。
          </P>
          <Callout type="warn">
            这里的验证刻意保持廉价，真正的类型与构建错误交给后续的 <Code>next build</Code> 与{" "}
            <Code>repair_build</Code> 处理。
          </Callout>
        </section>

        <section id="downstream" className="scroll-mt-24">
          <H2>下游组装</H2>
          <P>
            Section 文件生成完毕后，<Code>compose_layout</Code> 用已生成的 layout sections 拼出根{" "}
            <Code>layout.tsx</Code>；<Code>compose_page</Code> 按页并行，把该页各 section 组件 import 并组合进{" "}
            <Code>page.tsx</Code>。因此 section 生成步骤只负责「单文件正确导出 + JSX」，不负责页面级胶水逻辑（由后续 LLM 步骤完成）。
          </P>
          <P>
            更完整的步骤序号与并行关系见{" "}
            <Link href="/docs/pipeline" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
              AI 生成流水线
            </Link>
            。
          </P>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/design-system" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 设计系统生成
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
