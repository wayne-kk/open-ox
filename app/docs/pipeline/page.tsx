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
  { n: "02", name: "analyze_project_requirement", type: "llm+tool", desc: "将用户 prompt 解析为结构化的 ProjectBlueprint。配备 web_search 工具 — 遇到未知品牌名或专业术语时自动搜索。最多 4 次工具调用迭代。" },
  { n: "03", name: "infer_design_intent", type: "llm", desc: "独立风格推理节点。与步骤 02 并行，输出 designIntent（mood/colorDirection/style/keywords）。" },
  { n: "04", name: "plan_project", type: "llm", desc: "将蓝图细化为页面与 section 规划。与步骤 05 并行执行。" },
  { n: "05", name: "generate_project_design_system", type: "llm", desc: "基于 designIntent 生成 design-system.md（颜色、字体、间距、组件风格）。支持 /skill 注入 styleGuide。" },
  { n: "06", name: "apply_project_design_tokens", type: "llm", desc: "读取 globals.css，提取已有 @theme tokens，写入新的 CSS 变量。与步骤 08 并行执行。" },
  { n: "07", name: "describe_page_sections", type: "llm×M", desc: "按页面先生成整体结构描述，再拆分每个 section 的布局/背景/层次 brief。" },
  { n: "08", name: "generate_section ×N", type: "llm×N", desc: "并行生成 section，优先消费页面级 section brief；每个 section 运行时自发现 skill。" },
  { n: "09", name: "compose_layout", type: "llm", desc: "从生成的 layout sections（navigation/footer）组装 layout.tsx。" },
  { n: "10", name: "compose_page ×M", type: "llm×M", desc: "并行页面组装。每个 page.tsx 导入其 sections 并组合在一起。import 去重 + 重复渲染检测 + 自动 rebuild。" },
  { n: "11", name: "install_dependencies", type: "npm", desc: "扫描所有生成文件的 import 语句，与 package.json 对比，只安装缺失的包。" },
  { n: "12", name: "run_build", type: "build", desc: "本地执行 next build。失败则进入修复流程。" },
  { n: "13", name: "repair_build ×0-2", type: "llm+tool", desc: "Agent 工具循环：使用 read_file / edit_file / write_file / run_build 工具修复构建错误。每轮最多修复 3 个文件。最多 2 轮。" },
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
          确定性的 13 步编排（其中 8 个核心生成节点）。每个步骤都有明确的输入、输出和失败处理。
          生成阶段没有开放式 Agent 循环 — 只有修改阶段和构建修复才使用。
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
          <P>当前并行策略包含三层：</P>
          <Pre>{`// 第一层：plan + design system 并行执行
const [rawBlueprint, inferredDesignIntent] = await Promise.all([
  stepAnalyzeProjectRequirement(userInput),
  stepInferDesignIntent(userInput),
]);

// 第二层：plan + design system 并行执行
const [blueprint, designSystem] = await Promise.all([
  stepPlanProject(normalizedBlueprint),
  stepGenerateProjectDesignSystem(normalizedBlueprint, styleGuide),
]);

// 第三层：所有页面的所有 section 并行生成
const results = await Promise.allSettled(
  items.map((item) => stepGenerateSection({ ... }))
);
`}</Pre>
          <Callout>
            对于一个有 2 个页面、8 个 section 的网站，section 生成步骤会同时发起 8 次 LLM 调用。
            该步骤的耗时等于最慢的单次调用，而非所有调用的总和。
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
          <P>每次 section 生成调用的 system prompt 由多层组装而成：</P>
          <Pre>{`system prompt =
  frontend.md           // Next.js / React 基础规范
  + section.default.md  // 通用 section 规则
  + section.{type}.md   // 类型特定规则（hero、pricing、faq...）
  + skill content       // 选定的风格指导
  + guardrail blocks    // 约束规则（无障碍、首屏...）
  + traits block          // 结构化特征提示（layout/motion/visual/interaction）
  + outputTsx.md        // 输出格式要求

user message =
  design-system.md      // 项目设计系统
  + globals.css         // 已有 CSS（避免重复定义）
  + project context     // 角色、任务流、能力
  + page context        // slug、旅程阶段、设计计划
  + section spec        // 类型、意图、内容提示`}</Pre>
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
