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

const STEPS = [
  { n: "00", name: "validate_skill_prompts", type: "verify", desc: "启动前校验 ai 流程技能 Markdown 的 frontmatter；失败则中止，避免运行中途才发现技能损坏。" },
  { n: "01", name: "project_intent_guide", type: "llm", desc: "可选（默认开启）。澄清建站意向；若需用户补充信息则提前结束并返回引导文案（不进入生成）。可用 enableIntentGuide=false 关闭。" },
  {
    n: "01b",
    name: "research_subagent（可选）",
    type: "llm+tool",
    desc: "brief 含营销站参考 URL 时，编排层先跑 research Subagent 产出摘要；analyze 消费摘要，避免再吞整页 HTML。见 ADR-0006。",
  },
  { n: "02", name: "analyze_project_requirement", type: "llm+tool", desc: "解析 ProjectBlueprint，配备 web_search。与步骤 03 并行。" },
  { n: "03", name: "infer_design_intent", type: "llm", desc: "独立风格/技术关键词推理；产物合并进设计系统输入与 blueprint.keywords。与步骤 02 并行。" },
  {
    n: "04",
    name: "plan_project",
    type: "llm",
    desc: "扩展为 PlannedProjectBlueprint；自选 chromeForm（无 productType→壳查表），并规划 sharedContracts 供并行页前 stub。",
  },
  {
    n: "05",
    name: "generate_project_design_system",
    type: "skill | llm",
    desc: "DesignSystemResolver 先尝试版本化 Skill；只有无候选、低置信、冲突或截图复刻时才根据 infer + styleGuide 生成 design-system.md。",
  },
  { n: "06", name: "apply_project_design_tokens", type: "llm", desc: "设计系统 Markdown + 当前 app/globals.css → LLM 产出完整 globals.css（保留模板结构意图）。须先于 Chrome / Page Agent。" },
  {
    n: "07",
    name: "architect_scaffold_agent",
    type: "llm+tool",
    desc: "Chrome-first：落盘真实壳 app/layout.tsx + components/chrome/**（全局 form 时）；Page Agent 启动前壳已可预览。",
  },
  {
    n: "08",
    name: "page_implement_agent ×M",
    type: "llm×M",
    desc: "每页一个工具闭环，多页并行；只写页内容与页专属组件，不得改 layout/chrome/globals，不得复制全局 Nav/Footer。主区块须带 section id。",
  },
  {
    n: "09",
    name: "chrome_optimize_agent",
    type: "llm+tool",
    desc: "Link polish：全部页面落盘后勘察真实路由与 section 锚点，校正 Nav/Footer 链接；不换壳、不发明第二套导航。",
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
  {
    n: "13",
    name: "repair_build ×0-5",
    type: "llm+tool",
    desc: "构建仍失败时进入 Agent 修复循环（最多 5 轮）。修复后可挂 verifier Subagent；若 verdict 为 fail/partial，编排层可再调度一轮 refeed repair。",
  },
];

const TOC = [
  { id: "chrome-first", label: "Chrome-first" },
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
          {"// docs / pipeline"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">AI 生成流水线</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          默认 Chrome-first：先落真实全局壳，再并行写页内容，最后做链接精修。
          下表为主路径步骤索引；checkpoint 恢复时会跳过已完成阶段。修改阶段仍走独立 Modify Agent。
        </p>

        <section id="chrome-first" className="scroll-mt-24">
          <H2>Chrome-first（默认）</H2>
          <P>
            旧路径曾是 chrome-deferred（先并行写页再后置挂壳），容易出现双重导航。
            自 v1.17 / ADR-0005 起，默认所有权顺序为：
          </P>
          <Pre>{`Plan(chromeForm + sharedContracts)
  → design tokens
  → architect_scaffold_agent   // 真实 layout + components/chrome/**
  → shared contract stubs
  → page_implement_agent ×M    // 只填内容，可并行
  → chrome_optimize_agent      // 仅 link / 锚点 polish
  → images ∥ deps → typecheck → build → repair`}</Pre>
          <Callout>
            例外仅截图复刻（pass-through）。普通生成一律由 Chrome Scaffold
            落壳；<Code>page-local</Code> 已删除；<Code>none</Code> 仍为 Chrome
            拥有的极简壳。代码与 prompt 不得用 productType 查表或页内 regex 强制
            skip/mount。
          </Callout>
        </section>

        <section id="steps" className="scroll-mt-24">
          <H2>全部步骤</H2>
          <div className="space-y-2 mt-4">
            {STEPS.map(({ n, name, type, desc }) => (
              <div key={n} className="flex gap-4 rounded-xl border border-border bg-card px-4 py-3">
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
          <Pre>{`// 可选：research Subagent（brief 含参考站 URL）
const researchDigest = await runResearchSubagentIfNeeded(...);

// 第一层：analyze + infer_design_intent
await Promise.all([
  stepAnalyzeProjectRequirement({ ...userInput, researchDigest }),
  stepInferDesignIntent(userInput),
]);

// 第二层：plan（含 chromeForm）→ design system（串行；截图复刻时可插 analyze_screenshot_layout）
await stepPlanProject(...);
await stepGenerateProjectDesignSystem(...);

// 第三层：apply_project_design_tokens 单独先完成（写 globals.css）

// 第四层：Chrome-first — Scaffold 真壳 →（shared stubs）→ 并行 Page Agents → Optimize polish
await runArchitectScaffoldStep(...);
await stubSharedContractsIfNeeded(...);
const { files, pendingImages } = await generatePages(...); // 多页并行
await runChromeOptimizeStep(...); // link polish only
`}</Pre>
          <Callout>
            Scaffold 是全局壳的「单一拟定者」；Optimize 只校正链接与锚点。
            Page Agent 不得改 layout / chrome / globals，也不得在页内再造一套 Nav/Footer。
          </Callout>
        </section>

        <section id="skills" className="scroll-mt-24">
          <H2>Skill 系统</H2>
          <P>
            全局设计系统 Skill 是版本化 catalog；命中后直接成为 <Code>design-system.md</Code>。
            <Code>public/skills/</Code> 继续作为用户 styleGuide 来源，Hero 组件 Skill 则使用独立的运行时发现机制。
          </P>
          <Pre>{`ai/flows/generate_project/prompts/skills/design-system/
├── skill.yaml        # 选择元数据与版本
├── Academia.md
├── ArtDeco.md
├── ...
└── Vaporwave.md`}</Pre>
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
          <H3>Verifier refeed</H3>
          <P>
            修复轮次结束后可挂只读 <Code>verifier</Code> Subagent（报告不改代码）。
            当 verdict 为 <Code>fail</Code> / <Code>partial</Code> 时，编排层可再调度一轮
            refeed repair（有上限，避免无限循环）。见 ADR-0006。
          </P>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-between">
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
