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
  { id: "problem", label: "问题背景" },
  { id: "three-formats", label: "三种输出格式" },
  { id: "field-normalize", label: "字段级容错" },
  { id: "web-search", label: "Web Search 工具" },
  { id: "fallbacks", label: "Fallback 策略" },
];

export default function NormalizePage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / normalize
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Blueprint 容错解析</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          LLM 输出 JSON 时经常出现字段缺失、类型错误、结构不一致。
          <Code>asProjectBlueprint()</Code> 函数支持三种输出格式，
          并对每个字段做防御性 normalize — 比在 prompt 里反复强调"必须输出完整 JSON"更可靠。
        </p>

        <section id="problem" className="scroll-mt-24">
          <H2>问题背景</H2>
          <P>
            <Code>analyze_project_requirement</Code> 步骤要求 LLM 输出一个嵌套很深的 JSON 结构。
            实际观察到的失败模式：
          </P>
          <div className="mt-4 space-y-2">
            {[
              { pattern: "字段缺失", example: "roles 数组为空，或 productScope 整个缺失" },
              { pattern: "类型错误", example: "goals 应为 string[] 但输出了单个 string" },
              { pattern: "结构变体", example: "把所有字段平铺在顶层，而非嵌套在 brief/experience/site 下" },
              { pattern: "单页简化", example: "只输出 title + sections，没有多页结构" },
              { pattern: "JSON 截断", example: "上下文窗口不足时输出不完整的 JSON" },
            ].map(({ pattern, example }) => (
              <div key={pattern} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <code className="shrink-0 font-mono text-[11px] text-accent-tertiary/80 w-24">{pattern}</code>
                <span className="text-[12px] text-muted-foreground/70">{example}</span>
              </div>
            ))}
          </div>
          <Callout type="warn">
            在 prompt 中反复强调"必须输出完整 JSON"会增加 token 消耗，但并不能完全消除这些问题。
            防御性解析比 prompt 工程更可靠。
          </Callout>
        </section>

        <section id="three-formats" className="scroll-mt-24">
          <H2>三种输出格式</H2>
          <P>
            <Code>asProjectBlueprint()</Code> 按优先级依次尝试三种解析路径：
          </P>
          <Pre>{`function asProjectBlueprint(value: unknown): ProjectBlueprint {
  // 路径 1：标准嵌套结构（最常见）
  if (candidate.brief && candidate.experience && candidate.site) {
    return {
      brief: normalizeBrief(candidate.brief),
      experience: normalizeExperience(candidate.experience),
      site: normalizeSite(candidate.site),
    };
  }

  // 路径 2：扁平结构（LLM 有时会平铺所有字段）
  if (
    typeof flatCandidate.projectTitle === "string" &&
    flatCandidate.designIntent &&
    isSectionSpecArray(flatCandidate.layoutSections) &&
    Array.isArray(flatCandidate.pages)
  ) {
    return { brief: ..., experience: ..., site: ... }; // 重新组装
  }

  // 路径 3：单页简化结构（用户只描述了一个页面）
  if (
    typeof singlePage.title === "string" &&
    singlePage.designIntent &&
    isSectionSpecArray(singlePage.sections)
  ) {
    // 自动分离 layout sections（nav/footer）和 page sections
    const layoutSections = singlePage.sections.filter(
      s => s.type === "navigation" || s.type === "footer"
    );
    const pageSections = singlePage.sections.filter(
      s => s.type !== "navigation" && s.type !== "footer"
    );
    return { brief: ..., experience: ..., site: ... };
  }

  throw new Error("output does not match ProjectBlueprint");
}`}</Pre>
        </section>

        <section id="field-normalize" className="scroll-mt-24">
          <H2>字段级容错</H2>
          <P>每个字段都有独立的 normalize 函数，处理类型错误和缺失值：</P>
          <H3>roles 容错</H3>
          <Pre>{`function normalizeRoles(value: unknown): UserRole[] {
  // 空数组或非数组 → 自动创建默认 Visitor 角色
  if (!Array.isArray(value) || value.length === 0) {
    return [{
      roleId: "visitor",
      roleName: "Visitor",
      goals: ["Understand the offer", "Complete the primary conversion path"],
      coreActions: ["Scan the main message", "Take the primary CTA"],
      priority: "primary",
    }];
  }
  // 每个角色字段单独 normalize，缺失字段用合理默认值填充
  return value.map((item, index) => ({
    roleId: typeof item.roleId === "string" ? item.roleId
          : item.roleName?.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          ?? \`role-\${index + 1}\`,
    roleName: typeof item.roleName === "string" ? item.roleName : \`Role \${index + 1}\`,
    goals: isStringArray(item.goals) ? item.goals : ["Support the role's core goal"],
    // ...
  }));
}`}</Pre>
          <H3>fileName 的 PascalCase 转换</H3>
          <P>
            Section 的 <Code>fileName</Code> 字段会被转为 PascalCase，
            确保生成的 TSX 文件名符合 React 组件命名规范：
          </P>
          <Pre>{`function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)  // 按非字母数字分割
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// 示例
toPascalCase("hero-section")    → "HeroSection"
toPascalCase("pricing_table")   → "PricingTable"
toPascalCase("FAQ section")     → "FAQSection"`}</Pre>
          <H3>language 字段</H3>
          <P>
            <Code>language</Code> 字段决定所有生成内容的语言（中文/英文等）。
            如果 LLM 没有输出或输出空字符串，默认为 <Code>"en"</Code>：
          </P>
          <Pre>{`language: typeof candidate.language === "string" && candidate.language.trim()
  ? candidate.language.trim()
  : "en",`}</Pre>
        </section>

        <section id="web-search" className="scroll-mt-24">
          <H2>Web Search 工具</H2>
          <P>
            <Code>analyze_project_requirement</Code> 步骤配备了 <Code>web_search</Code> 工具。
            当用户 prompt 包含 LLM 不熟悉的品牌名、专业术语或新产品时，
            LLM 会先搜索再分析：
          </P>
          <Pre>{`// system prompt 中的指令
"Before analyzing the user's request, check if it contains any proper nouns,
brand names, people, products, or domain-specific terms you are unfamiliar with.
If so, use the web_search tool to look them up first."

// 工具调用示例
用户输入: "帮我做一个 Cursor 风格的 AI 代码编辑器官网"
→ LLM 调用 web_search("Cursor AI code editor")
→ 获取 Cursor 的产品定位、功能特点、视觉风格
→ 基于搜索结果生成更准确的 Blueprint`}</Pre>
          <P>
            最多允许 4 次工具调用迭代（<Code>maxIterations: 4</Code>）。
            搜索结果通过 SSE 实时推送到前端，用户可以看到 Agent 在搜索什么。
          </P>
          <Callout>
            Web Search 工具的调用结果会通过 <Code>onToolCall</Code> 回调传递给调用方，
            在 Build Studio 的进度面板中显示为 <Code>tool_call</Code> 事件。
          </Callout>
        </section>

        <section id="fallbacks" className="scroll-mt-24">
          <H2>Fallback 策略</H2>
          <P>各层级的 fallback 设计原则：宁可生成一个合理的默认值，也不要抛出错误。</P>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">字段</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">缺失时的 Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["roles", "自动创建 Visitor 角色（primary 优先级）"],
                  ["taskLoops", "基于第一个 role 创建默认核心旅程"],
                  ["capabilities", "空数组（不强制要求）"],
                  ["productScope", "从 projectDescription 推导"],
                  ["informationArchitecture", "从 pages 数组自动构建"],
                  ["sharedShells", '["Global navigation", "Global footer"]'],
                  ["language", '"en"'],
                  ["fileName", "从 type 字段 PascalCase 转换"],
                  ["priority (role)", '"primary"'],
                  ["priority (capability)", '"must-have"'],
                ].map(([field, fallback]) => (
                  <tr key={field} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{field}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{fallback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warn">
            只有两个字段是硬性必须的：<Code>brief.projectTitle</Code> 和
            <Code>brief.projectDescription</Code>。缺失这两个字段会抛出错误，
            因为没有合理的 fallback 可以替代用户的核心意图。
          </Callout>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/blueprint" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 项目蓝图
          </Link>
          <Link href="/docs/design-system" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            设计系统生成 <ArrowRight className="h-3.5 w-3.5" />
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
