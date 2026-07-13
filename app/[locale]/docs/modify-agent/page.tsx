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

const TOOLS = [
  { name: "read_file", color: "text-blue-400/80", bg: "bg-blue-500/10", desc: "读取文件完整内容（支持行范围）" },
  { name: "search_code", color: "text-primary/80", bg: "bg-primary/10", desc: "ripgrep 全项目搜索" },
  { name: "list_dir", color: "text-primary/80", bg: "bg-primary/10", desc: "列出目录内容" },
  { name: "edit_file", color: "text-amber-400/80", bg: "bg-amber-500/10", desc: "精确字符串替换（old_string → new_string）" },
  { name: "write_file", color: "text-amber-400/80", bg: "bg-amber-500/10", desc: "创建或覆盖文件" },
  { name: "generate_image", color: "text-fuchsia-400/80", bg: "bg-fuchsia-500/10", desc: "AI 生图写入 public/images（与生成流水线相同；仅代码修改 intent 暴露）" },
  { name: "run_build", color: "text-green-400/80", bg: "bg-green-500/10", desc: "执行 next build 验证变更" },
  { name: "exec_shell", color: "text-cyan-400/80", bg: "bg-cyan-500/10", desc: "受限 shell（诊断与脚手架；受策略与白名单约束）" },
  { name: "think", color: "text-slate-400/80", bg: "bg-slate-500/10", desc: "无副作用推理草稿，压缩进 reasoning 轨迹" },
  { name: "revert_file", color: "text-rose-400/80", bg: "bg-rose-500/10", desc: "按快照回滚单个文件" },
];

const TOC = [
  { id: "overview", label: "概览" },
  { id: "loop", label: "Agent 循环" },
  { id: "tools", label: "工具集" },
  { id: "stop-hooks", label: "Stop Hook" },
  { id: "memory", label: "工作记忆" },
  { id: "vision", label: "图片输入" },
];

export default function ModifyAgentPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / modify-agent
        </p>
        <h1 className="text-3xl font-bold tracking-tight">修改 Agent</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          受 Claude Code <Code>query()</Code> 设计启发的 Agent 循环。
          Agent 搜索、阅读、编辑、验证 — 配备质量门控，防止提前停止。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            与生成流水线（确定性步骤）不同，修改流是一个开放循环。
            Agent 自主决定读哪些文件、改什么、何时结束。
            Stop Hook 强制执行最低质量标准。
          </P>
          <Pre>{`runModifyProject(projectId, instruction, imageBase64?)
│
├── resolve_project   加载项目元数据
├── read_context      文件树 + design-system.md + globals.css
└── agent_loop        while(true)，最多 100 次迭代
      │
      ├── 第 1 次迭代：tool_choice="required"（必须行动，不允许空想）
      ├── 工具执行 → 更新循环状态
      ├── stop hook 检查 → 注入错误或允许停止
      └── 停止时：计算 diff → 持久化到 modificationHistory`}</Pre>
        </section>

        <section id="loop" className="scroll-mt-24">
          <H2>Agent 循环</H2>
          <H3>tool_choice 状态机</H3>
          <P>
            循环根据上一步的结果控制 <Code>tool_choice</Code>：
          </P>
          <div className="mt-4 space-y-2">
            {[
              { condition: "首次迭代", value: "required", reason: "强制先行动，再思考" },
              { condition: "stop hook 重试后", value: "required", reason: "已要求使用工具 — 强制执行" },
              { condition: "工具执行后", value: "auto", reason: "LLM 已有上下文，让它自主决策" },
            ].map(({ condition, value, reason }) => (
              <div key={condition} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <code className="shrink-0 font-mono text-[11px] text-muted-foreground/60 w-44">{condition}</code>
                <code className={`shrink-0 font-mono text-[11px] px-2 py-0.5 rounded ${value === "required" ? "bg-primary/15 text-primary/80" : "bg-white/8 text-muted-foreground/70"}`}>{value}</code>
                <span className="text-[12px] text-muted-foreground/60">{reason}</span>
              </div>
            ))}
          </div>
          <H3>自然语言 → 代码定位</H3>
          <P>
            用户描述的是 UI/产品语言，不是文件路径。由 Agent 结合 file tree、预读文件和工具自行定位——编排层不做关键词切分或固定目录猜测。
          </P>
          <Callout>
            入口 intent router（LLM）先分 <Code>conversation</Code> / <Code>read_only</Code> / <Code>plan_only</Code> / <Code>code_change</Code>，并可选输出 <Code>preloadPaths</Code>。
          </Callout>
        </section>

        <section id="tools" className="scroll-mt-24">
          <H2>工具集</H2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TOOLS.map(({ name, color, bg, desc }) => (
              <div key={name} className="rounded-xl border border-border bg-card px-4 py-3">
                <code className={`font-mono text-[12px] font-semibold ${color}`}>{name}</code>
                <p className="mt-1 text-[12px] text-muted-foreground/70">{desc}</p>
              </div>
            ))}
          </div>
          <H3>edit_file 的精确匹配要求</H3>
          <P>
            <Code>old_string</Code> 必须在文件中精确匹配唯一一处。
            Agent 被要求包含上下文行以确保唯一性，防止意外的多处替换。
          </P>
        </section>

        <section id="stop-hooks" className="scroll-mt-24">
          <H2>Stop Hook</H2>
          <P>
            当 LLM 停止调用工具时，stop hook 在允许循环退出前运行。
            它检查循环状态（是否探索过仓库、是否完成编辑/回答、类型错误、scoped tsc），并注入<strong>通用</strong> Agent 指令——不从用户句子里切关键词，也不硬编码搜索路径。
          </P>
          <Pre>{`function runStopHook(state, instruction, modifyMode, { profile }): string | null {
  if (!state.hasSearched && !state.hasEdited) {
    return modifyMode === "read_only"
      ? "Use read/search/list; answer in natural language; do not edit."
      : "Explore with tools from the file tree, then edit_file.";
  }
  if (modifyMode === "read_only" && state.hasSearched) return null;
  if (modifyMode === "code_change" && !state.hasEdited) return "Make edits now…";
  if (profile.verificationMode === "tsc_only") return null;
  // optional: remind run_scoped_tsc before finish
  return null;
}`}</Pre>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">参数</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">值</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">用途</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["MAX_ITERATIONS", "100", "循环迭代硬上限"],
                  ["MAX_STOP_HOOK_RETRIES", "5", "防止 stop hook 自身无限循环"],
                  ["stopHookRetries reset", "工具调用后", "成功执行工具后计数器归零"],
                ].map(([param, val, purpose]) => (
                  <tr key={param}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{param}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{val}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="memory" className="scroll-mt-24">
          <H2>对话记忆与工作记忆</H2>
          <P>
            持久层仍是 turn 列表（DB <Code>modificationHistory</Code> + session 合并去重）。
            注入主 Agent / Router 时不再塞「最近 10 轮全文」，而是：
          </P>
          <Pre>{`merged = mergeModifyHistoryTurns(dbHistory, sessionHistory)

// 工作记忆 = 从 turn 列表确定性投影（不落新 DB 列）
workingMemory = projectWorkingMemory(merged)
//   focusFiles (≤3) · pendingQuestion · lastIntent …

// 主 Agent：状态卡 + 最近 2 轮原文（非最近轮 Result 截断）
// Router：状态卡 + 短历史
// /clear → 两侧输入为空 → 投影为空`}</Pre>
          <P>
            用于稳住「再大一点」类短程指代，同时压低旧 Result 噪音。
            <Code>/clear</Code> 重置 session；<Code>/memory</Code> 打开调试面板（
            <Code>GET /api/projects/[id]/memory</Code>）查看将注入的投影与历史。
          </P>
        </section>

        <section id="vision" className="scroll-mt-24">
          <H2>图片输入</H2>
          <P>
            用户可以粘贴截图配合文字指令。图片以 vision content array 格式发送在第一条用户消息中：
          </P>
          <Pre>{`content: imageBase64 ? [
  {
    type: "image_url",
    image_url: {
      url: imageBase64.startsWith("data:") ? imageBase64
         : \`data:image/png;base64,\${imageBase64}\`,
      detail: "high",
    },
  },
  { type: "text", text: userMessage },
] : userMessage`}</Pre>
          <Callout>
            图片保存在 <Code>modifyHistory</Code> 中，并在对话 UI 中显示为缩略图。
            Agent 可以参考截图中的视觉细节来决定修改内容。
          </Callout>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-between">
          <Link href="/docs/pipeline" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> AI 生成流水线
          </Link>
          <Link href="/docs/preview" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            预览沙箱 <ArrowRight className="h-3.5 w-3.5" />
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
