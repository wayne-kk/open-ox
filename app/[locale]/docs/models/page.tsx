import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function Pre({ children }: { children: React.ReactNode }) {
  return <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-border bg-muted px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">{children}</pre>;
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
  return <code className="rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">{children}</code>;
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
setStepModel("page_implement_agent", "gpt-5.2")

// 优先级 2：请求级覆盖
setRuntimeModelId("gemini-3.1-pro-preview")

// 优先级 3：全局默认（最低）
DEFAULT_MODEL = "gemini-3-flash-preview"
→ 环境变量 OPENAI_MODEL 可覆盖

// Modify Agent 默认（可与生成不同）
MODIFY_DEFAULT_MODEL = "claude-opus-4-6"  // 或由 MODIFY_MODEL 覆盖

function getModelForStep(stepName: string): ModelId {
  return getStepModel(stepName)  // 步骤级
      ?? getModelId();            // 请求级 → 全局默认
}`}</Pre>
        </section>

        <section id="builtin" className="scroll-mt-24">
          <H2>内置模型</H2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
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
                  <tr key={id} className="hover:bg-muted/50">
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
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">步骤 ID</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["analyze_project_requirement", "需求分析（Blueprint）"],
                  ["infer_design_intent", "风格 / 技术关键词推断"],
                  ["plan_project", "站点与页面规划"],
                  ["generate_project_design_system", "Style Reference 设计系统 Markdown"],
                  ["apply_project_design_tokens", "globals.css Token"],
                  ["architect_scaffold_agent", "Chrome 快速搭壳"],
                  ["chrome_optimize_agent", "Chrome 精修（路由/锚点）"],
                  ["page_implement_agent", "单页工具闭环实现"],
                  ["preselect_skills", "Hero 等场景的内部 skill 选型（复用步骤 id）"],
                  ["repair_build", "构建失败修复 Agent"],
                ].map(([id, label]) => (
                  <tr key={id} className="hover:bg-muted/50">
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
              { steps: "analyze + infer + plan + design_system + architect", model: "强模型", reason: "理解与结构设计成本高，错误代价大" },
              { steps: "page_implement_agent（多页并行）", model: "快模型或均衡模型", reason: "调用次数与迭代深度最大，需在质量与延迟间权衡" },
              { steps: "repair_build", model: "强模型", reason: "需读懂编译日志并精确改文件" },
            ].map(({ steps, model, reason }) => (
              <div key={steps} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <code className="font-mono text-[11px] text-foreground/80">{steps}</code>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${model === "强模型" ? "bg-primary/15 text-primary/80" : "bg-green-500/15 text-green-400/80"}`}>{model}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground/60">{reason}</p>
              </div>
            ))}
          </div>
          <Callout>
            多页场景下，每个 slug 各有一套 <Code>page_implement_agent</Code> 会话；将<strong>快模型</strong>配给该步骤通常比配给已移除的{" "}
            <Code>generate_section</Code> 批量路径更能缩小墙钟时间。
          </Callout>
        </section>

        <section id="custom" className="scroll-mt-24">
          <H2>自定义模型</H2>
          <P>
            通过 <Code>model_configs</Code> 表可以添加任意 OpenAI-compatible 模型。
            添加后会出现在前端的模型选择器中。
          </P>
          <Pre>{`interface ModelConfig {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsThinking?: boolean; // 网关可按模型能力开启 reasoning
}`}</Pre>
          <P>
            步骤级覆盖持久化在 <Code>step_model_configs</Code> 表（含可选{" "}
            <Code>thinking_level</Code> 列），启动生成前由{" "}
            <Code>loadStepModelsFromDB()</Code> 装载。
          </P>
          <P>
            由于使用原生 fetch 而非 OpenAI SDK，只要提供商兼容 <Code>/chat/completions</Code> 接口，
            就可以无缝接入 — 包括 Gemini、Anthropic（via proxy）、本地 Ollama 等。
          </P>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-start">
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
