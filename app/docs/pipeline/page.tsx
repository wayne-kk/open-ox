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

const STEPS = [
  { n: "00", name: "validate_skill_prompts", type: "verify", desc: "启动前校验 ai 流程技能 Markdown 的 frontmatter；失败则中止，避免运行中途才发现技能损坏。" },
  { n: "01", name: "project_intent_guide", type: "llm", desc: "可选（默认开启）。澄清建站意向；若需用户补充信息则提前结束并返回引导文案（不进入生成）。可用 enableIntentGuide=false 关闭。" },
  { n: "02", name: "analyze_project_requirement", type: "llm+tool", desc: "解析 ProjectBlueprint，配备 web_search。与步骤 03 并行。" },
  { n: "03", name: "infer_design_intent", type: "llm", desc: "独立风格/技术关键词推理；产物合并进设计系统输入与 blueprint.keywords。与步骤 02、03b 并行。" },
  { n: "03b", name: "extract_user_provided_content", type: "llm+tool", desc: "从用户 query 整理 userProvidedContent（地址、图片 URL、菜单等），写入 content/user-provided.md。与步骤 02、03 并行；Plan 之前合并进 blueprint。" },
  { n: "04", name: "plan_project", type: "llm", desc: "扩展为 PlannedProjectBlueprint（pages、sections、pageDesignPlan）。与步骤 05a 并行。" },
  {
    n: "05a",
    name: "match_design_system_skill",
    type: "llm",
    desc: "与用户 prompt 比对内置 design-system skill；命中则直接使用 skill 正文作为 design-system.md。与步骤 04 并行（enableSkills=false 时跳过）。",
  },
  {
    n: "05b",
    name: "generate_project_design_system",
    type: "llm",
    desc: "未命中内置 skill 时执行：根据 infer 文本 + 可选用户 styleGuide 生成 design-system.md。",
  },
  { n: "06", name: "apply_project_design_tokens", type: "llm", desc: "设计系统 Markdown + 当前 app/globals.css → LLM 产出完整 globals.css（保留模板结构意图）。须先于 Chrome / Page Agent。" },
  {
    n: "07",
    name: "architect_scaffold_agent",
    type: "llm+tool",
    desc: "Chrome 搭壳 Agent：快速落盘 app/layout.tsx 与 components/chrome/**（结构完整，Nav 链接可占位），供 Page Agent 只读。",
  },
  {
    n: "08",
    name: "page_implement_agent ×M",
    type: "llm×M",
    desc: "每页一个工具闭环（读写文件、generate_image、page_implementation_complete 等），多页并行；不得修改 layout/chrome/globals。单页主区块须带 section id。",
  },
  {
    n: "09",
    name: "chrome_optimize_agent",
    type: "llm+tool",
    desc: "Chrome 精修 Agent：全部页面落盘后，用工具勘察真实路由与锚点，校正 Nav/Footer 并 polish chrome。",
  },
  {
    n: "10",
    name: "await_images ∥ install_dependencies",
    type: "mixed",
    desc: "等待 Agent 触发的异步生图落盘；并与依赖扫描安装并行（npm），保证构建前图片与 node_modules 齐备。",
  },
  {
    n: "11",
    name: "typecheck_generated",
    type: "verify",
    desc: "默认开启：对生成范围内的 TS/TSX 做语言服务级检查（非全仓 tsc）。失败时可触发 repair_build 打补丁。DISABLE_PREBUILD_TSC=1 跳过。" },
  { n: "12", name: "run_build (+ TS codeFix 内循环)", type: "build", desc: "本地 next build；编译错误时可反复尝试 TypeScript code-fix 再构建（与 repair 轮次配合）。" },
  { n: "13", name: "repair_build ×0-5", type: "llm+tool", desc: "构建仍失败时进入 Agent 修复循环（最多 5 轮）；定位错误日志相关文件并增量修改。" },
];

const TOC = [
  { id: "steps", label: "全部步骤" },
  { id: "parallel", label: "并行策略" },
  { id: "skills", label: "Skill 系统" },
  { id: "prompts", label: "Prompt 分层" },
  { id: "repair", label: "构建修复" },
];

export default function PipelinePage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / pipeline
        </p>
        <h1 className="text-3xl font-bold tracking-tight">AI 生成流水线</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          下表为主路径步骤索引（含启动校验与可选意向引导）；checkpoint 恢复时会跳过已完成阶段。
          页面代码由多路 <Code>page_implement_agent</Code> 并行落地；修改阶段仍走独立 Modify Agent。
        </p>

        <section id="steps" className="scroll-mt-24">
          <H2>全部步骤</H2>
          <div className="space-y-2 mt-4">
            {STEPS.map(({ n, name, type, desc }) => (
              <div key={n} className="flex gap-4 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/30 w-5 pt-0.5">{n}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-[12px] text-foreground/85">{name}</code>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${type.startsWith("llm") ? "bg-primary/15 text-primary/80" :
                      type === "build" ? "bg-green-500/15 text-green-400/80" :
                        type === "npm" ? "bg-blue-500/15 text-blue-400/80" :
                          type === "verify" ? "bg-violet-500/15 text-violet-300/80" :
                            type === "mixed" ? "bg-cyan-500/12 text-cyan-300/85" :
                          "bg-white/8 text-muted-foreground/60"
                      }`}>{type}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="parallel" className="scroll-mt-24">
          <H2>并行策略</H2>
          <P>当前编排里与耗时相关的并行阶段大致如下：</P>
          <Pre>{`// 第一层：analyze + infer_design_intent + extract_user_provided_content（当前实现）
await Promise.all([
  stepAnalyzeProjectRequirement(userInput),
  stepInferDesignIntent(userInput),
  stepExtractUserProvidedContent({ userInput }),
]);

// 第二层：plan_project + match/generate design system（当前实现）
const [planOutcome, matchResult] = await Promise.all([...]);

// 第三层：apply_project_design_tokens 必须单独先完成（写 globals.css，避免与 Agent 写文件竞态）

// 第四层：Architect 先于 generatePages —— layout/chrome 落盘后再启动各 page_implement_agent，
//        第一轮 prompt 中的 layout.tsx 快照与磁盘一致。
await runArchitectStep({ blueprint, designSystem, ... });
const { files, pendingImages } = await generatePages({
  blueprint,
  designSystem,
  runtimeContext,
  ...,
});
`}</Pre>
          <Callout>
            Architect 仍是 chrome 的「单一拟定者」（layout + components/chrome/**）；Page Agent 不得修改这些路径。
            Page Agent 在 Architect 完成之后启动，第一轮预读上下文中的 layout 与落盘版本对齐；墙钟时间上该段约等于 Architect
            耗时加上与「最慢的 Page Agent」并行段之和。
          </Callout>
        </section>

        <section id="skills" className="scroll-mt-24">
          <H2>Skill 系统</H2>
          <P>
            风格技能是 <Code>public/skills/</Code> 目录下的 Markdown 文件。每个文件描述一种视觉方向 —
            字体规则、色彩哲学、组件风格。
          </P>
          <Pre>{`public/skills/
├── minimal.md       # 极简：大量留白，单色调，字体主导
├── bold.md          # 大胆：高对比度，超大字体，强烈色彩
├── glassmorphism.md # 玻璃拟态：毛玻璃效果，半透明层次，纵深感
└── brutalist.md     # 野兽派：原始网格，强烈对比，反精致`}</Pre>
          <H3>运行时 Skill 发现</H3>
          <P>
            每个 section 在生成时自行发现并选择 skill（不再有全局 preselect 步骤）。
            先用 LLM 从候选列表中选择，失败时降级到 score-based 关键词匹配。
            完整的 Markdown 内容只在 section 实际生成时才加载。
          </P>
          <Pre>{`// Runtime discovery — per section
const candidates = discoverSkillsBySectionType(root, section.type);
// LLM selection → fallback: scoreSkillFallback(candidates, haystack)
const skillPrompt = loadSelectedSkillPrompt(selectedSkillId);`}</Pre>
        </section>

        <section id="prompts" className="scroll-mt-24">
          <H2>Prompt 分层</H2>
          <P>
            <Code>page_implement_agent</Code> 的 system 由{" "}
            <Code>frontend</Code> + <Code>steps/pageImplementAgent.md</Code> +{" "}
            <Code>shared/agentRuleBundles.ts</Code>{" "}
            中列出的 <Code>prompts/rules/*.md</Code>（<Code>loadGuardrail</Code> 按序拼接）组成。
            <Code>architect_scaffold_agent</Code> / <Code>chrome_optimize_agent</Code> 同理，另含 <Code>section.navigation</Code> 等。
            可按环境变量 <Code>PAGE_IMPLEMENT_AGENT_EXTRA_RULES</Code> / <Code>ARCHITECT_AGENT_EXTRA_RULES</Code>（逗号分隔 id）追加规则。
          </P>
          <Pre>{`system prompt =
  frontend.md
  + steps/pageImplementAgent.md
  + rules from agentRuleBundles (e.g. tailwindMappingGuide, section.default, outputTsx…)

user message (page agent) =
  design-system.md
  + pre-read layout.tsx / globals.css / trees
  + page design plan + project context
  + optional hero skill body`}</Pre>
        </section>

        <section id="repair" className="scroll-mt-24">
          <H2>构建修复</H2>
          <P>
            当 <Code>next build</Code> 失败后，修复步骤从错误输出中提取文件名，
            只将相关文件发送给 LLM 修复 — 而非整个代码库。
          </P>
          <Pre>{`const maxRepairAttempts = 5;
for (let repairRound = 0; repairRound <= maxRepairAttempts; repairRound++) {
  const buildResult = await stepRunBuild();
  if (buildResult.success) return { verificationStatus: "passed" };

  if (repairRound < maxRepairAttempts) {
    await stepRepairBuild({
      blueprint,
      buildOutput: buildResult.output,
      generatedFiles,
    });
    await autoInstallDependenciesForFiles(/* touched files */);
  }
}`}</Pre>
          <Callout type="warn">
            最多 5 轮修复。如果构建仍然失败，<Code>verificationStatus</Code> 设为
            <Code>failed</Code>，项目标记为包含未验证文件。
          </Callout>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/architecture" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 系统架构
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
