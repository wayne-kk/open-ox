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

const TOOLS = [
  { name: "read_file", color: "text-blue-400/80", bg: "bg-blue-500/10", desc: "读取文件完整内容" },
  { name: "search_code", color: "text-primary/80", bg: "bg-primary/10", desc: "ripgrep 全项目搜索" },
  { name: "list_dir", color: "text-primary/80", bg: "bg-primary/10", desc: "列出目录内容" },
  { name: "edit_file", color: "text-amber-400/80", bg: "bg-amber-500/10", desc: "精确字符串替换（old_string → new_string）" },
  { name: "write_file", color: "text-amber-400/80", bg: "bg-amber-500/10", desc: "创建新文件" },
  { name: "run_build", color: "text-green-400/80", bg: "bg-green-500/10", desc: "执行 next build 验证变更" },
];

const TOC = [
  { id: "overview", label: "概览" },
  { id: "loop", label: "Agent 循环" },
  { id: "tools", label: "工具集" },
  { id: "stop-hooks", label: "Stop Hook" },
  { id: "memory", label: "对话记忆" },
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
└── agent_loop        while(true)，最多 40 次迭代
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
              <div key={condition} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <code className="shrink-0 font-mono text-[11px] text-muted-foreground/60 w-44">{condition}</code>
                <code className={`shrink-0 font-mono text-[11px] px-2 py-0.5 rounded ${value === "required" ? "bg-primary/15 text-primary/80" : "bg-white/8 text-muted-foreground/70"}`}>{value}</code>
                <span className="text-[12px] text-muted-foreground/60">{reason}</span>
              </div>
            ))}
          </div>
          <H3>自然语言 → 代码定位</H3>
          <P>用户描述的是他们看到的东西，而非代码结构。Agent 负责翻译：</P>
          <Pre>{`"那个极致性能的区块"  →  search "性能" → search "performance"
"首页那个大标题"      →  home_HeroSection.tsx heading element
"导航栏颜色不对"      →  layout_NavSection.tsx or app/layout.tsx
"底部版权信息"        →  layout_FooterSection.tsx`}</Pre>
          <Callout>
            Agent 总是先尝试中文关键词搜索，然后再试英文等价词。
            如果找到多个候选项，会向用户确认而非猜测。
          </Callout>
        </section>

        <section id="tools" className="scroll-mt-24">
          <H2>工具集</H2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TOOLS.map(({ name, color, bg, desc }) => (
              <div key={name} className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
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
            它按顺序检查四个门控：
          </P>
          <Pre>{`function runStopHook(state, instruction): string | null {
  if (!state.hasSearched && !state.hasEdited) {
    const keywords = extractKeywords(instruction).slice(0, 5);
    return \`You stopped without tools. Search first: \${keywords}\`;
  }
  if (!state.hasEdited) {
    return "You searched but made no changes. Read files and edit.";
  }
  if (!state.hasBuild) {
    return "Changes made but not verified. Call run_build.";
  }
  if (!state.buildPassed) {
    return \`Build failed:\\n\${buildOutput}\\nFix the errors.\`;
  }
  return null; // all gates passed
}`}</Pre>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">参数</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">值</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">用途</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["MAX_ITERATIONS", "40", "循环迭代硬上限"],
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
          <H2>对话记忆</H2>
          <P>
            每次修改运行都可以访问之前的修改记录作为上下文。记忆从两个来源合并并去重：
          </P>
          <Pre>{`// DB 历史（跨 session 持久化）
const dbHistory = project.modificationHistory.map(r => ({
  instruction: r.instruction,
  summary: \`\${r.plan.analysis} Files: \${r.touchedFiles.join(", ")}\`,
}));

// Session 历史（从客户端传入）
const merged = [
  ...dbHistory,
  ...sessionHistory.filter(h => !seenInstructions.has(h.instruction)),
].slice(-10); // 最多 10 轮`}</Pre>
          <P>
            用户可以在修改输入框中输入 <Code>/clear</Code> 重置 session 记忆。
            <Code>/memory</Code> 命令打开调试面板，显示将注入下次 prompt 的完整合并历史。
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

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
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
