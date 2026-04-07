import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight border-b border-white/8 pb-3">{children}</h2>;
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-[13px] leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

const PHASE_ROWS: [string, string, string][] = [
  ["analyze_project_requirement", "steps/analyzeProjectRequirement.md + outputJson", "用户 prompt / 蓝图输入"],
  ["plan_project", "steps/planProject.md + outputJson", "规范化蓝图 JSON"],
  ["generate_project_design_system", "frontend + steps/generateProjectDesignSystem.md", "蓝图 + 可选 styleGuide"],
  ["apply_project_design_tokens", "frontend + steps/applyProjectDesignTokens.md", "globals + 设计系统"],
  ["preselect_skills（已移除）", "—", "v1.0 起由每个 section 运行时自发现"],
  ["generate_section", "见 §3", "见 §4"],
  ["compose_layout / compose_page", "frontend + steps/compose*.md + outputTsx", "已生成文件 + 蓝图"],
  ["repair_build", "frontend + steps/repairBuild.md + outputJson", "构建日志 + 相关文件"],
];

const PROMPT_PLACEMENT_ROWS: [string, string][] = [
  ["全局写代码约定", "ai/prompts/systems/frontend.md"],
  ["某 section.type 通用结构", "prompts/sections/section.{type}.md"],
  ["组件气质 skill", "prompts/skills/*.md + frontmatter"],
  ["版式 pattern", "prompts/layouts/*.md（已废弃，收敛到 skill）"],
  ["动效", "prompts/motions/*.md（已废弃，收敛到 traits）"],
  ["红线 guardrail", "prompts/rules/*.md（允许 ID 由规则文件扫描，见仓库 docs/architecture-section-prompts.md）"],
  ["某一步任务", "prompts/steps/{name}.md"],
  ["JSON/TSX 输出格式", "prompts/rules/outputJson.md、outputTsx.md"],
];

const TOC = [
  { id: "phases", label: "与提示词相关的阶段" },
  { id: "skills", label: "Skill 预选与正文" },
  { id: "system", label: "generate_section System" },
  { id: "user", label: "generate_section User" },
  { id: "capability", label: "traits → 内联提示" },
  { id: "logs", label: "日志" },
  { id: "cheat", label: "新提示放哪" },
];

export default function GenerateProjectTracePage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / generate-project-trace
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Generate Project：Skill 与 Prompt 拼装 Trace</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          <Code>runGenerateProject</Code> 流水线里组件 skill 如何选出、每个 section 的 system/user 如何拼接，以及日志里能看到什么。
          对照代码：<Code>runGenerateProject.ts</Code>、<Code>steps/generateSection.ts</Code>、
          <Code>steps/selectComponentSkills.ts</Code>、<Code>shared/files.ts</Code>。
        </p>

        <Callout>
          <strong className="text-foreground/90">Guardrail</strong> 白名单、默认推断与合并规则见仓库{" "}
          <Code>docs/architecture-section-prompts.md</Code>。
        </Callout>

        <Callout>
          <strong className="text-foreground/90">路径约定</strong>：下文 <Code>steps/</Code>、<Code>prompts/</Code> 等目录均相对于{" "}
          <Code>ai/flows/generate_project/</Code>，除非写为 <Code>ai/prompts/…</Code>。
        </Callout>

        <section id="phases" className="scroll-mt-24">
          <H2>1. 总览：与提示词相关的阶段</H2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-3 py-2.5 font-semibold text-foreground/85 w-[28%]">阶段</th>
                  <th className="px-3 py-2.5 font-semibold text-foreground/85">System 主要来源</th>
                  <th className="px-3 py-2.5 font-semibold text-foreground/85">User 主要来源</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {PHASE_ROWS.map(([phase, sys, user]) => (
                  <tr key={phase} className="border-b border-white/6 last:border-0">
                    <td className="px-3 py-2 align-top font-mono text-[11px] text-foreground/75">{phase}</td>
                    <td className="px-3 py-2 align-top">{sys}</td>
                    <td className="px-3 py-2 align-top">{user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="skills" className="scroll-mt-24">
          <H2>2. Skill：预选与正文加载</H2>
          <ol className="mt-3 list-decimal pl-5 text-[14px] leading-7 text-muted-foreground space-y-2">
            <li>
              <strong className="text-foreground/85">预选</strong> <Code>preselectSkillsForSections</Code>：按 <Code>section.type</Code> 用{" "}
              <Code>discoverSkillsBySectionType</Code> 收集候选；一次 LLM 返回 <Code>selections[fileName] = skillId | null</Code>；
              非法或缺失时用 <Code>fallback: true</Code> 候选。
            </li>
            <li>
              <strong className="text-foreground/85">传入</strong>{" "}
              <Code>{`stepGenerateSection({ preselectedSkillId })`}</Code>：已传则不再调用{" "}
              <Code>stepSelectComponentSkills</Code>。
            </li>
            <li>
              <strong className="text-foreground/85">正文</strong> <Code>loadSkillPrompt(id)</Code> → <Code>prompts/skills/&#123;id&#125;.md</Code>；
              <Code>null</Code> 则 skill 块为空。
            </li>
          </ol>
        </section>

        <section id="system" className="scroll-mt-24">
          <H2>3. generate_section：System 拼接顺序（与代码一致）</H2>
          <P>
            <Code>steps/generateSection.ts</Code> → <Code>buildSystemPrompt</Code>，自上而下 <Code>{"\\n\\n"}</Code> 连接：
          </P>
          <ol className="mt-3 list-decimal pl-5 text-[14px] leading-7 text-muted-foreground space-y-2">
            <li>
              <Code>loadSystem(&quot;frontend&quot;)</Code> → <Code>ai/prompts/systems/frontend.md</Code>
            </li>
            <li>
              <Code>section.default.md</Code> + 若有则 <Code>section.&#123;type&#125;.md</Code>
            </li>
            <li>组件 skill 全文（若有）</li>
            <li>
              <Code>projectGuardrailIds</Code> ∪ <Code>designPlan.guardrailIds</Code> → <Code>loadGuardrail</Code>（
              <Code>prompts/rules/&#123;id&#125;.md</Code>）
            </li>
            <li>
              <Code>designPlan.traits</Code> → <Code>buildTraitsBlock</Code>（内联生成 layout/motion/visual/interaction 提示文本，无需文件查找）
            </li>
            <li>
              <Code>loadGuardrail(&quot;outputTsx&quot;)</Code>
            </li>
          </ol>
          <P>重试时在整段 system 末尾追加 <Code>retryHint</Code>。</P>
        </section>

        <section id="user" className="scroll-mt-24">
          <H2>4. generate_section：User 消息块</H2>
          <P>
            <Code>buildUserMessage</Code>：<Code>Design System</Code> → <Code>globals.css</Code> → <Code>Project Context</Code> →
            Roles / Task Loops / Capabilities → <Code>Known Routes</Code> → <Code>Page Context</Code> →{" "}
            <Code>Section to Generate</Code>（含完整 <Code>designPlan</Code>，列出 <Code>guardrailIds</Code> 与{" "}
            <Code>traits</Code>）。
          </P>
        </section>

        <section id="capability" className="scroll-mt-24">
          <H2>5. traits → 内联提示</H2>
          <P>
            <Code>buildTraitsBlock</Code> 从 <Code>designPlan.traits</Code> 结构化对象生成内联 Markdown 提示：
          </P>
          <ol className="mt-3 list-decimal pl-5 text-[14px] leading-7 text-muted-foreground space-y-2">
            <li>
              <Code>traits.layout</Code> → 布局类型、比例、方向等结构化描述
            </li>
            <li>
              <Code>traits.motion</Code> → 动效强度（subtle/ambient/energetic/none）和触发时机
            </li>
            <li>
              <Code>traits.visual</Code> → 视觉密度、对比度、风格
            </li>
            <li>
              <Code>traits.interaction</Code> → 交互模式描述
            </li>
          </ol>
          <P>
            不再依赖文件系统白名单。LLM 在 schema 约束内自由组合 traits，系统将其转为内联提示文本注入 system prompt。
          </P>
        </section>

        <section id="logs" className="scroll-mt-24">
          <H2>6. 日志：.open-ox/logs/generate_project/</H2>
          <P>
            每步目录下 <Code>output.json</Code>（section 步）含 <Code>skillId</Code>、<Code>section.designPlan</Code> 等；
            <strong className="text-foreground/85"> 完整 </strong>
            <Code>systemPrompt</Code> / <Code>userMessage</Code> 在内存 <Code>StepTrace.llmCall</Code>，默认不落盘到该 JSON。
          </P>
        </section>

        <section id="cheat" className="scroll-mt-24">
          <H2>7. 新提示放哪（速查）</H2>
          <P>下表中的 <Code>prompts/</Code> 均指 <Code>ai/flows/generate_project/prompts/</Code>。</P>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-3 py-2.5 font-semibold text-foreground/85 w-[32%]">目的</th>
                  <th className="px-3 py-2.5 font-semibold text-foreground/85">位置</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {PROMPT_PLACEMENT_ROWS.map(([goal, loc]) => (
                  <tr key={goal} className="border-b border-white/6 last:border-0">
                    <td className="px-3 py-2 align-top">{goal}</td>
                    <td className="px-3 py-2 align-top font-mono text-[11px] text-foreground/70">{loc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/pipeline" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> AI 生成流水线
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
                <a
                  href={`#${item.id}`}
                  className="block text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors py-0.5"
                >
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
