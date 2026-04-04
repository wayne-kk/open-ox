import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
function Callout({ children }: { children: React.ReactNode }) {
  return <div className="my-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-[13px] leading-6 text-muted-foreground">{children}</div>;
}

const TOC = [
  { id: "priority", label: "三层优先级" },
  { id: "builtin", label: "内置模型" },
  { id: "steps", label: "步骤级配置" },
  { id: "strategy", label: "推荐策略" },
  { id: "custom", label: "自定义模型" },
];

export default function ModelsPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">// docs / models</p>
        <h1 className="text-3xl font-bold tracking-tight">模型配置</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          三层模型配置系统，支持全局默认、请求级覆盖和步骤级覆盖。
          兼容任何 OpenAI-compatible API 提供商。
        </p>

        <section id="priority" className="scroll-mt-24">
          <H2>三层优先级</H2>
          <P>模型选择按以下优先级从高到低解析：</P>
          <Pre>{`// 优先级 1：步骤级覆盖（最高）
setStepModel("generate_section", "gpt-5.2")
→ 仅 generate_section 步骤使用 gpt-5.2

// 优先级 2：请求级覆盖
setRuntimeModelId("gemini-3.1-pro-preview")
→ 本次请求全程使用此模型（除非被步骤级覆盖）

// 优先级 3：全局默认（最低）
DEFAULT_MODEL = "gemini-3-flash-preview"
→ 环境变量 OPENAI_MODEL 可覆盖`}</Pre>
          <Pre>{`// 解析逻辑
function getModelForStep(stepName: string): ModelId {
  return getStepModel(stepName)  // 步骤级
      ?? getModelId();            // 请求级 → 全局默认
}`}</Pre>
        </section>

        <section id="builtin" className="scroll-mt-24">
          <H2>内置模型</H2>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">模型 ID</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">显示名称</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">上下文窗口</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["gemini-3-flash-preview", "Gemini 3 Flash", "128K"],
                  ["gemini-3.1-pro-preview", "Gemini 3.1 Pro", "128K"],
                  ["gpt-5.2", "GPT-5.2", "128K"],
                ].map(([id, name, ctx]) => (
                  <tr key={id} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{id}</td>
                    <td className="px-4 py-2.5 text-foreground/80">{name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/60">{ctx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            默认模型为 <Code>gemini-3-flash-preview</Code>，兼顾速度和质量。
            用户可以在前端的模型选择器中切换。
          </P>
        </section>

        <section id="steps" className="scroll-mt-24">
          <H2>步骤级配置</H2>
          <P>每个生成步骤都可以独立配置模型：</P>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">步骤 ID</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["analyze_project_requirement", "需求分析"],
                  ["plan_project", "项目规划"],
                  ["generate_project_design_system", "设计系统"],
                  ["apply_project_design_tokens", "设计 Token"],
                  ["preselect_skills", "技能匹配"],
                  ["generate_section", "组件生成"],
                  ["compose_page", "页面组合"],
                  ["repair_build", "构建修复"],
                ].map(([id, label]) => (
                  <tr key={id} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{id}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="strategy" className="scroll-mt-24">
          <H2>推荐策略</H2>
          <P>
            不同步骤对模型能力的需求不同。推荐的配置策略是：
          </P>
          <div className="mt-4 space-y-2">
            {[
              { steps: "analyze + plan + design_system", model: "强模型", reason: "需要深度理解用户意图和产品逻辑" },
              { steps: "generate_section", model: "快模型", reason: "数量最多（N 个并行），速度优先" },
              { steps: "repair_build", model: "强模型", reason: "需要理解构建错误并精确修复" },
              { steps: "preselect_skills", model: "快模型", reason: "简单分类任务，不需要强推理" },
            ].map(({ steps, model, reason }) => (
              <div key={steps} className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                  <code className="font-mono text-[11px] text-foreground/80">{steps}</code>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${model === "强模型" ? "bg-primary/15 text-primary/80" : "bg-green-500/15 text-green-400/80"}`}>{model}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground/60">{reason}</p>
              </div>
            ))}
          </div>
          <Callout>
            对于 8 个 section 的项目，<Code>generate_section</Code> 步骤会并行发起 8 次 LLM 调用。
            使用快模型（如 gemini-flash）可以将这个步骤从 ~40s 压缩到 ~15s。
          </Callout>
        </section>

        <section id="custom" className="scroll-mt-24">
          <H2>自定义模型</H2>
          <P>
            通过 <Code>model_configs</Code> 表可以添加任意 OpenAI-compatible 模型。
            添加后会出现在前端的模型选择器中。
          </P>
          <Pre>{`// ModelConfig 接口
interface ModelConfig {
  id: string;           // 模型 ID（传给 API 的 model 字段）
  displayName: string;  // 前端显示名称
  contextWindow: number; // 上下文窗口大小
}`}</Pre>
          <P>
            由于使用原生 fetch 而非 OpenAI SDK，只要提供商兼容 <Code>/chat/completions</Code> 接口，
            就可以无缝接入 — 包括 Gemini、Anthropic（via proxy）、本地 Ollama 等。
          </P>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-start">
          <Link href="/docs/preview" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 预览沙箱
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
