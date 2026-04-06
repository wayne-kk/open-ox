import Link from "next/link";
import { ArrowRight } from "lucide-react";

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight border-b border-white/8 pb-3">
      {children}
    </h2>
  );
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

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-white/8 bg-[#080a0d] px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">
      {children}
    </pre>
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
  { id: "overview", label: "系统概览" },
  { id: "stack", label: "技术栈" },
  { id: "flow", label: "请求流程" },
  { id: "api", label: "API 路由" },
  { id: "triggers", label: "输入触发器系统" },
  { id: "modify-agent", label: "Modify Agent" },
  { id: "persistence", label: "数据持久化" },
  { id: "decisions", label: "关键决策" },
];

export default function ArchitecturePage() {
  return (
    <div className="flex gap-10">
      {/* Article */}
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / architecture
        </p>

        <h1 className="text-3xl font-bold tracking-tight">系统架构</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          基于 Next.js 15 的全栈 AI 流水线。无需独立后端 — API Routes、AI 编排和前端全部在同一个仓库中。
        </p>

        {/* ── Overview ── */}
        <Section id="overview">
          <H2>系统概览</H2>
          <P>
            Open-OX Studio 由三个主要层次构成：Next.js 前端（SSR + 客户端状态）、
            AI 流水线（服务端编排）、以及外部服务（Supabase、E2B、LLM API）。
          </P>
          <Pre>{`浏览器
  └── /studio/[projectId]   ← React 客户端，SSE 消费者
        │
        ├── POST /api/projects      → 创建 DB 记录，返回 projectId
        ├── POST /api/ai            → 启动生成流（SSE）
        ├── POST /api/.../modify    → 启动修改流（SSE）
        └── POST /api/.../preview   → 启动 E2B 沙箱

服务端（Next.js API Routes）
  ├── AI 流水线（generate_project / modify_project）
  ├── Supabase 客户端（projects 表 + Storage）
  └── E2B SDK（云端沙箱管理）`}</Pre>
          <Callout>
            <Code>projectId</Code> 在 AI 流水线启动之前就已创建。用户可以在生成过程中关闭浏览器，
            重新进入时通过 DB 中的增量 buildSteps 恢复进度。
          </Callout>
        </Section>

        {/* ── Stack ── */}
        <Section id="stack">
          <H2>技术栈</H2>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">层次</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">技术</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">选型理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["框架", "Next.js 15 App Router", "SSR + API Routes 合一，无需独立后端"],
                  ["语言", "TypeScript 严格模式", "AI 生成代码的类型安全保障"],
                  ["样式", "Tailwind CSS v4 + shadcn/ui", "CSS 变量驱动主题，AI 可直接操作"],
                  ["数据库", "Supabase (PostgreSQL)", "托管 Postgres + Storage + 实时订阅"],
                  ["沙箱", "E2B Cloud", "隔离的 Node 环境，支持 next build"],
                  ["LLM", "OpenAI-compatible API", "可切换 Gemini / GPT / 任意提供商"],
                ].map(([layer, tech, why]) => (
                  <tr key={layer} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{layer}</td>
                    <td className="px-4 py-2.5 text-foreground/80">{tech}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3>为什么用原生 fetch 而非 OpenAI SDK</H3>
          <P>
            OpenAI SDK 内部使用 <Code>agentkeepalive</Code>，默认 socket timeout 为 8 秒。
            单次 section 生成调用可达 60 秒，SDK 会强制断连。
            原生 fetch 配合 <Code>AbortSignal.timeout(300_000)</Code> 覆盖所有场景。
          </P>
          <Pre>{`const res = await fetch(\`\${baseURL}/chat/completions\`, {
  method: "POST",
  body: JSON.stringify({ model, messages, tools }),
  signal: AbortSignal.timeout(300_000), // 5 min
});`}</Pre>
        </Section>

        {/* ── Flow ── */}
        <Section id="flow">
          <H2>请求流程</H2>
          <P>从用户输入到上线预览的完整生命周期：</P>
          <Pre>{`1. 用户输入 prompt → 点击 Build
2. POST /api/projects  → 创建 DB 记录（status=generating）
3. 服务端立即返回 projectId（< 100ms）
4. 浏览器跳转到 /studio/{projectId}
5. 页面检测 status=generating 且 buildSteps 为空
6. 自动触发 POST /api/ai，传入 projectId
7. 服务端运行 AI 流水线，每个步骤完成后：
   a. SSE 事件推送到浏览器（实时显示）
   b. 写入 Supabase（支持断线恢复）
8. status → ready / failed`}</Pre>
          <Callout type="warn">
            如果用户在生成过程中关闭标签页，重新打开 <Code>/studio/[id]</Code> 会启动
            3 秒轮询循环，并显示 DB 中已完成的步骤。
          </Callout>
        </Section>

        {/* ── API ── */}
        <Section id="api">
          <H2>API 路由</H2>
          <div className="mt-4 space-y-2">
            {[
              { method: "POST", path: "/api/projects", desc: "创建项目记录，返回 projectId" },
              { method: "GET", path: "/api/projects", desc: "获取所有项目列表" },
              { method: "GET", path: "/api/projects/[id]", desc: "按 ID 获取项目（用于轮询）" },
              { method: "DELETE", path: "/api/projects/[id]", desc: "删除项目及文件" },
              { method: "POST", path: "/api/ai", desc: "启动生成流水线（SSE 流）" },
              { method: "POST", path: "/api/projects/[id]/modify", desc: "启动修改 Agent（SSE 流）" },
              { method: "POST", path: "/api/projects/[id]/preview", desc: "启动 E2B 沙箱（首次）" },
              { method: "PUT", path: "/api/projects/[id]/preview", desc: "修改后重建预览" },
              { method: "GET", path: "/api/models", desc: "获取可用 LLM 模型列表" },
              { method: "GET", path: "/api/skills", desc: "获取可用风格技能列表" },
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-2.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${method === "GET" ? "bg-blue-500/15 text-blue-400" :
                  method === "POST" ? "bg-green-500/15 text-green-400" :
                    method === "PUT" ? "bg-amber-500/15 text-amber-400" :
                      "bg-red-500/15 text-red-400"
                  }`}>{method}</span>
                <code className="shrink-0 text-[12px] font-mono text-foreground/80">{path}</code>
                <span className="text-[12px] text-muted-foreground/70">{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Trigger System ── */}
        <Section id="triggers">
          <H2>输入触发器系统</H2>
          <P>
            HeroPrompt 输入框支持多种触发器，在文本任意位置通过特殊字符激活。
            选中后以彩色 chip 形式注入，提交时各 chip 的 payload 合并到请求体。
          </P>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">触发符</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">功能</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">提交字段</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["/", "风格模板选择（如 /glassmorphism）", "styleGuide"],
                  ["@", "引用已有项目作为设计参考", "referenceProjectId"],
                  ["#", "约束标签（#暗色主题 #极简 #中文）", "prompt 追加"],
                  ["URL", "粘贴 URL 自动提取为参考", "referenceUrl"],
                  ["图片", "粘贴截图作为视觉参考", "imageBase64"],
                ].map(([trigger, desc, field]) => (
                  <tr key={trigger} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{trigger}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/80">{desc}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{field}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <H3>架构</H3>
          <Pre>{`app/hooks/usePromptTriggers.ts   — 统一触发器 hook（检测 / @ # + 光标位置）
app/components/ui/TriggerMenu.tsx — 浮层下拉菜单（按类型显示不同颜色前缀）
app/components/ui/PromptChips.tsx — 注入的标签展示（含图片缩略图）
app/components/ui/QuickTemplates.tsx — 快捷模板 pills`}</Pre>
          <P>
            触发检测基于光标位置：从光标往前搜索最近的触发字符，
            触发字符必须在行首或空格后，且到光标之间不含空格。
            这允许用户在文本中间任意位置触发菜单。
          </P>
        </Section>

        {/* ── Modify Agent ── */}
        <Section id="modify-agent">
          <H2>Modify Agent</H2>
          <P>
            生成后的迭代修改由 Modify Agent 处理 — 一个受 Claude Code 启发的开放式 Agent 循环。
            Agent 在单次循环中完成搜索、阅读、编辑和验证。
          </P>
          <H3>工具列表</H3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["read_file", "search_code", "list_dir", "edit_file", "write_file", "run_build", "exec_shell", "think", "revert_file"].map((t) => (
              <code key={t} className="rounded bg-white/6 border border-white/8 px-2 py-0.5 font-mono text-[11px] text-foreground/80">{t}</code>
            ))}
          </div>
          <H3>4-Phase 工作流</H3>
          <Pre>{`Phase 1: ORIENT  — search_code + list_dir，建立全局理解
Phase 2: READ    — 只读 1-2 个最相关文件，形成修改计划
Phase 3: EDIT    — edit_file 精确替换，最小改动
Phase 4: VERIFY  — run_build 验证编译`}</Pre>
          <H3>安全机制</H3>
          <P>
            <Code>Must read before edit</Code> — edit_file 前必须先 read_file，防止盲改。
            <Code>Loop Detection</Code> — 连续 4 次操作同一文件时注入策略转换提示。
            <Code>Tool Result Budget</Code> — 单条结果上限 30K 字符。
            <Code>Context 压缩</Code> — 基于相关性，热文件保留完整，冷文件压缩。
          </P>
        </Section>

        {/* ── Persistence ── */}
        <Section id="persistence">
          <H2>数据持久化</H2>
          <H3>projects 表</H3>
          <div className="overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">字段</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">类型</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["id", "text PK", "{timestamp}_{slug} — URL 可读，全局唯一"],
                  ["status", "enum", "generating / ready / failed"],
                  ["blueprint", "jsonb", "analyze 步骤输出的完整 ProjectBlueprint"],
                  ["build_steps", "jsonb[]", "增量写入 — 每步完成后立即持久化"],
                  ["modification_history", "jsonb[]", "每次修改的完整记录（含 diff）"],
                  ["sandbox_id", "text", "E2B 沙箱 ID（用于重连）"],
                  ["verification_status", "enum", "passed / failed（next build 结果）"],
                ].map(([field, type, notes]) => (
                  <tr key={field} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{field}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{type}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            生成的文件同时存储在本地文件系统（<Code>sites/{"{projectId}"}/</Code>）
            和 Supabase Storage 中。当服务器重启导致本地文件丢失时，E2B 预览会从 Storage 恢复。
          </P>
        </Section>

        {/* ── Decisions ── */}
        <Section id="decisions">
          <H2>关键工程决策</H2>
          {[
            {
              title: "projectId 在 AI 启动前创建",
              body: "支持断线恢复、可分享 URL、以及无需重新输入 prompt 的重试。",
            },
            {
              title: "buildSteps 增量持久化",
              body: "每个步骤完成后立即写入 DB。用户中途关闭页面后重新进入，看到的是真实进度而非空白。",
            },
            {
              title: "Blueprint normalize 层",
              body: "asProjectBlueprint() 对每个字段做 normalize 并提供 fallback。LLM 输出不一致时不会导致流水线崩溃。",
            },
            {
              title: "E2B 预览使用静态导出",
              body: "next build + npx serve 启动较慢，但产出稳定 URL 且资源占用极低。next dev 需要为每个项目维持一个持久进程。",
            },
          ].map(({ title, body }) => (
            <div key={title} className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
              <p className="text-[13px] font-semibold text-foreground/90">{title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground/80">{body}</p>
            </div>
          ))}
        </Section>

        {/* Next page */}
        <div className="mt-14 border-t border-white/8 pt-8 flex justify-end">
          <Link
            href="/docs/pipeline"
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
          >
            Next: AI 生成流水线 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </article>

      {/* TOC */}
      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
            本页目录
          </p>
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
