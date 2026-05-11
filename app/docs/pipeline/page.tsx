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
  { n: "01", name: "clear_template", type: "fs", desc: "清理上次生成的文件。当提供了 projectId 时跳过（项目目录已初始化）。" },
  { n: "02", name: "analyze_project_requirement", type: "llm+tool", desc: "将用户 prompt 解析为结构化的 ProjectBlueprint。配备 web_search。与步骤 03 并行。" },
  { n: "03", name: "infer_design_intent", type: "llm", desc: "独立风格推理。与步骤 02 并行。" },
  { n: "04", name: "plan_project", type: "llm", desc: "将蓝图细化为页面与 pageDesignPlan。与步骤 05 并行。" },
  {
    n: "05",
    name: "match_design_system_skill · generate_project_design_system",
    type: "llm",
    desc: "内置 design-system skill 匹配命中则落盘 design-system.md；否则 LLM 生成 design-system.md。与步骤 04 并行。",
  },
  { n: "06", name: "apply_project_design_tokens", type: "llm", desc: "设计系统 Markdown + 当前 globals → LLM 写出完整 globals.css。必须先于步骤 07–08，避免 Agent 覆盖。" },
  {
    n: "07",
    name: "architect_agent",
    type: "llm+tool",
    desc: "Architect：app/layout.tsx + components/chrome/**。先于步骤 08 串行完成，便于 Page Agent 读到定稿 chrome。",
  },
  {
    n: "08",
    name: "page_implement_agent ×M",
    type: "llm×M",
    desc: "在步骤 07 完成之后多页并行落地 page.tsx / 页面组件；禁止写 layout/chrome/globals。",
  },
  {
    n: "09",
    name: "install_dependencies",
    type: "npm",
    desc: "等待异步图片就绪后安装缺失依赖；与其它生成文件的 import 扫描并行收尾。",
  },
  {
    n: "10",
    name: "typecheck_generated",
    type: "verify",
    desc: "对本次生成涉及的 TS/TSX 做范围类型检查（非全仓 tsc）。失败可走 repair_build 前的修复链路。",
  },
  { n: "11", name: "run_build", type: "build", desc: "本地 next build。" },
  { n: "12", name: "repair_build ×0-2", type: "llm+tool", desc: "构建失败时的 Agent 工具循环（read/edit/write + 增量验证）。" },
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
          当前为主路径约 12 步的编排（按项目与 checkpoint 略有增减）；LLM Page Agent 仍为开放式工具闭环。
          修改阶段沿用独立 Modify Agent。
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
          <Pre>{`// 第一层：analyze + infer_design_intent（当前实现）
await Promise.all([
  stepAnalyzeProjectRequirement(userInput),
  stepInferDesignIntent(userInput),
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
            <Code>architect_agent</Code> 同理，另含 <Code>section.navigation</Code> 等。
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
          <Pre>{`for (let attempt = 0; attempt <= 2; attempt++) {
  const result = await stepRunBuild();
  if (result.success) return { verificationStatus: "passed" };

  const repair = await stepRepairBuild({
    blueprint,
    buildOutput: result.output,  // error log → file extraction
    generatedFiles: result.generatedFiles,
  });
  // Re-install any new deps introduced by the fix
  await autoInstallDependenciesForFiles({ files: repair.touchedFiles });
}`}</Pre>
          <Callout type="warn">
            最多 2 轮修复。如果构建仍然失败，<Code>verificationStatus</Code> 设为
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
