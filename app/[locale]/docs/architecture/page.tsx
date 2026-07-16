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
    <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight border-b border-border pb-3">
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
    <code className="rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[12px] text-foreground/90">
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 mb-4 overflow-x-auto rounded-xl border border-border bg-muted px-5 py-4 font-mono text-[12px] leading-6 text-muted-foreground">
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
  { id: "surfaces", label: "产品面" },
  { id: "stack", label: "技术栈" },
  { id: "flow", label: "请求流程" },
  { id: "api", label: "API 路由" },
  { id: "triggers", label: "输入触发器系统" },
  { id: "design-mode", label: "Design Mode" },
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
          基于 Next.js 16 App Router 的全栈 AI 流水线。无需独立后端 — API Routes、AI 编排和前端全部在同一个仓库中。
        </p>

        {/* ── Overview ── */}
        <Section id="overview">
          <H2>系统概览</H2>
          <P>
            Open-OX Studio 由三个主要层次构成：Next.js 前端（SSR + 客户端状态）、
            AI 流水线（服务端编排）、以及外部服务（Supabase、E2B、LLM API）。
          </P>
          <Pre>{`浏览器
  ├── /dashboard · /community   ← Workspace / Community（App Shell）
  └── /studio/[projectId]       ← React 客户端，SSE 消费者
        │
        ├── POST /api/projects      → 创建 DB 记录，返回 projectId
        ├── POST /api/ai            → 启动生成流（SSE）
        ├── POST /api/.../modify    → 启动修改流（SSE）
        ├── POST /api/.../design-mode/patch → Design Mode Direct Apply
        └── POST /api/.../preview   → 启动/刷新预览（后端随 OPEN_OX_PREVIEW_BACKEND 分支）

服务端（Next.js API Routes）
  ├── AI 流水线（generate Chrome-first · modify + Subagent）
  ├── Supabase（projects + acquisition / credits / tags + Storage）
  └── 预览：OPEN_OX_PREVIEW_BACKEND env → local | storage | e2b`}</Pre>
          <Callout>
            <Code>projectId</Code> 在 AI 流水线启动之前就已创建。用户可以在生成过程中关闭浏览器，
            重新进入时通过 DB 中的增量 buildSteps 恢复进度。
          </Callout>
        </Section>

        <Section id="surfaces">
          <H2>产品面</H2>
          <P>
            自 2026-07 起，可见性与发现拆成独立产品面（ADR-0002）。默认项目对其他用户不可见。
          </P>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">面</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">路由</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">谁可见</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["Workspace", "/dashboard", "仅所有者（须登录）；文件夹筛选"],
                  ["Community", "/community", "任何人；仅 Publish Preview + listed"],
                  ["Studio", "/studio/[id]", "仅所有者（或 Admin）；非所有者不可进他人项目"],
                  ["Admin", "/admin/…", "Admin；全量项目与强制下架"],
                ].map(([surface, route, who]) => (
                  <tr key={surface} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{surface}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{route}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <H3>Publish / Remix 两轴</H3>
          <P>
            <Code>publish_preview</Code>：上架社区 + 静态预览可被非所有者打开。
            <Code>allow_remix</Code>：授予拷贝许可（仅 Preview 开启时可开；关 Preview 自动关 Remix）。
            Remix 创建独立新项目，不拷贝 Studio 对话与密钥。
          </P>
        </Section>

        {/* ── Stack ── */}
        <Section id="stack">
          <H2>技术栈</H2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">层次</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">技术</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">选型理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["框架", "Next.js 16 App Router", "SSR + API Routes 合一，无需独立后端"],
                  ["语言", "TypeScript 严格模式", "AI 生成代码的类型安全保障"],
                  ["样式", "Tailwind CSS v4 + shadcn/ui", "CSS 变量驱动主题，AI 可直接操作"],
                  ["数据库", "Supabase (PostgreSQL)", "托管 Postgres + Storage + 实时订阅"],
                  ["认证", "飞书 / Google / Linux.do OAuth", "按环境开关；/api/auth/config 暴露可用提供商"],
                  ["沙箱 / 预览", "local · Storage · E2B", "预览后端可选：本地 dev、静态导出+代理、或云端沙箱"],
                  ["LLM", "OpenAI-compatible API", "可切换 Gemini / GPT / 任意提供商"],
                  ["Subagent", "ai/shared/subagent", "explore / verifier / research；嵌套深度 1（ADR-0006）"],
                ].map(([layer, tech, why]) => (
                  <tr key={layer} className="hover:bg-muted/50">
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
              { method: "POST", path: "/api/projects", desc: "创建项目记录，返回 projectId（需登录）" },
              {
                method: "GET",
                path: "/api/projects",
                desc: "仅当前用户 Workspace 项目；folder=all|uncategorized|uuid（all=根目录）",
              },
              { method: "GET", path: "/api/projects/gallery", desc: "Workspace 画廊列表（同上范围）" },
              { method: "GET", path: "/api/community/projects", desc: "公开社区列表（Publish Preview + listed）" },
              { method: "GET", path: "/api/projects/[id]", desc: "按 ID 获取项目（用于轮询）" },
              { method: "PATCH", path: "/api/projects/[id]", desc: "重命名、文件夹、Publish Preview / Allow Remix（仅所有者）" },
              { method: "DELETE", path: "/api/projects/[id]", desc: "删除项目及文件（仅所有者）" },
              { method: "POST", path: "/api/projects/[id]/remix", desc: "Remix 社区项目到自己的 Workspace" },
              { method: "POST", path: "/api/ai", desc: "启动生成流水线（SSE 流）" },
              { method: "POST", path: "/api/projects/[id]/modify", desc: "启动修改 Agent（SSE 流）" },
              { method: "POST", path: "/api/projects/[id]/design-mode/patch", desc: "Design Mode Direct Apply（源坐标 AST）" },
              { method: "POST", path: "/api/projects/[id]/preview", desc: "启动或刷新预览（local/storage/e2b；未发布时非所有者不可访问）" },
              { method: "PUT", path: "/api/projects/[id]/preview", desc: "修改后重建预览" },
              { method: "GET", path: "/api/models", desc: "获取可用 LLM 模型列表" },
              { method: "GET", path: "/api/skills", desc: "获取可用风格技能列表" },
            ].map(({ method, path, desc }) => (
              <div key={`${method} ${path}`} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
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
          <Callout>
            <strong className="text-foreground/90">访问控制：</strong>
            Workspace 列表与 mutate 仅所有者（Admin 例外）。
            Community / 静态预览 / 封面：非所有者须项目已开启 Publish Preview。
            完整路由表见 <Link href="/docs/api" className="text-primary underline underline-offset-4">API 参考</Link>。
          </Callout>
        </Section>

        {/* ── Trigger System ── */}
        <Section id="triggers">
          <H2>输入触发器系统</H2>
          <P>
            HeroPrompt 输入框支持多种触发器，在文本任意位置通过特殊字符激活。
            选中后以彩色 chip 形式注入，提交时各 chip 的 payload 合并到请求体。
          </P>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
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
                  <tr key={trigger} className="hover:bg-muted/50">
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

        {/* ── Design Mode ── */}
        <Section id="design-mode">
          <H2>Design Mode</H2>
          <P>
            Studio live preview 内点选元素，微调文案与四类样式（color / font-size / padding / border-radius）。
            定位主键为编译期注入的 <Code>data-ox-source</Code>（file:line:col）；写盘走服务端 JSX AST Direct Apply。
            不可 Direct 时预填 Modify 草稿，由用户确认后走 Agent（ADR-0001）。
          </P>
          <Pre>{`Preview iframe
  └── source instrumentation → data-ox-source
  └── design-mode-bridge.js → VisualEdit[]
        │
Studio  └── POST /api/projects/[id]/design-mode/patch
              ├── AST mutate (static className / text)
              ├── prettier + verify
              └── hot refresh (local next-dev)
        └── 失败 / 无锚点 → Modify draft prefill`}</Pre>
          <P>
            详见{" "}
            <Link href="/docs/design-mode" className="text-primary underline underline-offset-4">
              Design Mode 文档
            </Link>
            。
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
              <code key={t} className="rounded bg-muted border border-border px-2 py-0.5 font-mono text-[11px] text-foreground/80">{t}</code>
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
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">字段</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">类型</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["id", "text PK", "{timestamp}_{slug} — URL 可读，全局唯一"],
                  ["user_id", "uuid FK", "所属用户（auth.users）"],
                  ["owner_username", "text", "创建时写入的展示名（血缘 / 社区卡片）"],
                  ["folder_id", "uuid FK?", "单层文件夹（project_folders），可空=根目录"],
                  ["status", "enum", "generating / ready / failed"],
                  ["publish_preview", "bool", "上架社区 + 静态预览对非所有者开放"],
                  ["allow_remix", "bool", "允许登录用户 Remix（依赖 publish_preview）"],
                  ["listing", "enum", "listed / unlisted（社区发现；预留 unlisted）"],
                  ["blueprint", "jsonb", "analyze 步骤输出的完整 ProjectBlueprint"],
                  ["build_steps", "jsonb[]", "增量写入 — 每步完成后立即持久化"],
                  ["modification_history", "jsonb[]", "每次修改的完整记录（含 diff）"],
                  ["cover_image_*", "…", "封面状态 / Storage 路径 / 更新时间"],
                  ["sandbox_id", "text", "E2B 沙箱 ID（用于重连）"],
                  ["verification_status", "enum", "passed / failed（next build 结果）"],
                ].map(([field, type, notes]) => (
                  <tr key={field} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{field}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground/60">{type}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            源码持久化在 Storage 桶 <Code>project-files</Code>；静态预览产物在{" "}
            <Code>site-previews</Code>（由 <Code>/site-previews/…</Code> 代理访问）。
            本地丢失时从 <Code>project-files</Code> 恢复到 <Code>sites/</Code> 后再构建预览。
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
              title: "Workspace 默认私有",
              body: "列表与 mutate 仅所有者；社区发现与静态预览依赖显式 Publish Preview，避免「登录即可见」。",
            },
            {
              title: "Design Mode 源坐标 + 服务端 AST",
              body: "定位用 data-ox-source，写盘只用 Direct Apply；Modify 是人工出口而非第二条自动写盘引擎。",
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
              title: "静态预览默认走 Storage（本地开发）",
              body: "配置 Service Role 与 NEXT_PUBLIC_SITE_URL 且未指定 OPEN_OX_PREVIEW_BACKEND 时，本地默认与生产一致使用静态导出 + 代理，避免 Dev Server 与 CSP 差异。",
            },
          ].map(({ title, body }) => (
            <div key={title} className="mt-4 rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[13px] font-semibold text-foreground/90">{title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground/80">{body}</p>
            </div>
          ))}
        </Section>

        {/* Next page */}
        <div className="mt-14 border-t border-border pt-8 flex justify-end">
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
