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
          站点 UI 的主路径已收敛为：单一 <Code>architect_agent</Code> 拟定全局 chrome，
          再由每个页面的 <Code>page_implement_agent</Code> 工具闭环编写{" "}
          <Code>page.tsx</Code> 及页面级组件。下文描述该路径及与之配套的 Hero skill 发现；
          历史上的「逐文件 generate_section 批量步骤」不再作为主路径。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            核心实现见{" "}
            <Code>ai/flows/generate_project/runGenerateProject.ts</Code> 中的{" "}
            <Code>generatePages</Code> →{" "}
            <Code>ai/flows/generate_project/steps/pageImplementAgent.ts</Code> 内的{" "}
            <Code>runPageImplementAgent</Code>。
            <Code>plan_project</Code> 已为每页写入 <Code>pageDesignPlan</Code>（叙事、层级、约束），
            Agent 以 design-system、预读的 <Code>layout.tsx</Code> / <Code>globals.css</Code>、目录树与用户旨意为上下文，
            自主决定拆分哪些组件文件，并以工具调用落盘；收尾必须调用{" "}
            <Code>page_implementation_complete</Code>。
          </P>
        </section>

        <section id="upstream" className="scroll-mt-24">
          <H2>上游：规划与数据</H2>
          <P>
            <Code>plan_project</Code>（提示词见 <Code>ai/flows/generate_project/prompts/steps/planProject.agent.md</Code>）把「仅有页面、尚无 section」的蓝图，
            扩展为 <Code>PlannedProjectBlueprint</Code>：为每个页面推导 <Code>sections[]</Code>，并为每个 section 挂上{" "}
            <Code>designPlan</Code>。
          </P>
          <Callout>
            布局形态（顶 nav / sidebar / 工具栏 / 页脚 / 无 chrome 等）由下游页面实现 Agent 自行决定，
            <Code>plan_project</Code> 与 <Code>analyze_project_requirement</Code> 都不负责预先指定全局 chrome。
          </Callout>
        </section>

        <section id="orchestration" className="scroll-mt-24">
          <H2>编排与并行</H2>
          <P>
            <Code>apply_project_design_tokens</Code> 与 <Code>architect_agent</Code> 必须<strong>先于</strong>
            任意 <Code>page_implement_agent</Code> 完成，以避免 globals / layout 竞态。
            全部页面的 Page Agent 在 Architect 结束后用 <Code>Promise.all</Code> 并行启动；
            每页步骤名为 <Code>page_implement_agent:{"{slug}"}</Code>，拓扑与日志中可按 slug 区分。
          </P>
          <H3>Hero 运行时 Skill</H3>
          <P>
            当策略判定需要为首页 Hero 注入额外特效指引时，会在该页 Agent 启动前调用{" "}
            <Code>discoverAndSelectSkill</Code>（内部候选来自技能清单 + 关键词 fallback），
            仅将选中技能的<strong>正文</strong>注入该页 Agent 的 user 消息；这不是全局步骤，也不替代用户在前端选择的{" "}
            <Code>styleGuide</Code>（后者走设计系统生成）。
          </P>
          <Pre>{`// runGenerateProject.ts — 每页并行
const pageOutcomes = await Promise.all(
  blueprint.site.pages.map((page) =>
    runPageImplementAgent({ page, designSystem, projectContext, heroSkillPrompt, ... })
  )
);`}</Pre>
        </section>

        <section id="prompt" className="scroll-mt-24">
          <H2>单次页面的 Prompt</H2>
          <H3>System：分层拼接</H3>
          <P>
            Page Implement Agent 的 system 由 <Code>frontend.md</Code>、
            <Code>steps/pageImplementAgent.md</Code> 以及{" "}
            <Code>shared/agentRuleBundles.ts</Code> 指定的{" "}
            <Code>prompts/rules/*.md</Code>（<Code>tailwindMappingGuide</Code>、<Code>section.default</Code>、
            <Code>outputTsx</Code> 等）顺序拼接。可按环境变量{" "}
            <Code>PAGE_IMPLEMENT_AGENT_EXTRA_RULES</Code> 追加规则 id。
          </P>
          <H3>User：契约 + 任务</H3>
          <P>
            User 消息包含完整 <Code>design-system.md</Code>、序列化后的{" "}
            <Code>pageDesignPlan</Code>、站点路由与项目语境，以及预先注入的只读快照：
            当前 <Code>app/layout.tsx</Code>、<Code>app/globals.css</Code>、
            <Code>components/</Code> 与 <Code>app/</Code> 的目录树摘要。
            若存在 Hero skill 正文，则一并附加。详见{" "}
            <Link href="/docs/generate-project-trace" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
              Prompt 拼装 Trace
            </Link>
            。
          </P>
        </section>

        <section id="validation" className="scroll-mt-24">
          <H2>验证与重试</H2>
          <P>
            Agent 工具写入的文件仍会经过统一的格式化（如 Prettier）；路由级错误主要由后续的{" "}
            <Code>typecheck_generated</Code>、<Code>run_build</Code> 与 <Code>repair_build</Code> 捕获。
          </P>
          <Callout type="warn">
            这里的验证主要由 Agent 自身与后续构建网关承担；不要在页面 Agent 内重复跑完整{" "}
            <Code>next build</Code>（除非排查具体错误），全局验证由流水线统一调度。
          </Callout>
        </section>

        <section id="downstream" className="scroll-mt-24">
          <H2>下游组装</H2>
          <P>
            Page Agent 负责目标路由文件及其拆出的组件；全局 shell 已由 Architect 锁定。
            流水线在全部页面完成后执行依赖安装、可选范围类型检查与生产构建。
          </P>
          <P>
            更完整的步骤序号与并行关系见{" "}
            <Link href="/docs/pipeline" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">
              AI 生成流水线
            </Link>
            。
          </P>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-between">
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
