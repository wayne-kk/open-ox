import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function MethodBadge({ m }: { m: Method }) {
  const cls =
    m === "GET"
      ? "bg-blue-500/15 text-blue-400"
      : m === "POST"
        ? "bg-green-500/15 text-green-400"
        : m === "PUT"
          ? "bg-amber-500/15 text-amber-400"
          : m === "PATCH"
            ? "bg-violet-500/15 text-violet-400"
            : "bg-red-500/15 text-red-400";
  return <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${cls}`}>{m}</span>;
}

const SECTIONS: { title: string; rows: { method: Method; path: string; desc: string }[] }[] = [
  {
    title: "Workspace 项目",
    rows: [
      { method: "POST", path: "/api/projects", desc: "创建项目，返回 projectId（需登录；可选 imageBase64 / folderId）" },
      { method: "GET", path: "/api/projects", desc: "仅当前用户项目；folder=all|uncategorized|uuid（all=根目录 folder_id null）；offset / limit" },
      { method: "GET", path: "/api/projects/gallery", desc: "Workspace 画廊列表（同上范围，含封面元数据；客户端再拉 cover）" },
      { method: "GET", path: "/api/projects/[id]", desc: "项目详情（轮询生成进度；所有者或已发布可见字段）" },
      { method: "PATCH", path: "/api/projects/[id]", desc: "重命名、移动文件夹、Publish Preview / Allow Remix" },
      { method: "DELETE", path: "/api/projects/[id]", desc: "删除项目及关联文件（所有者）" },
      { method: "POST", path: "/api/projects/[id]/remix", desc: "从可 Remix 的社区项目拷贝到自己的 Workspace" },
      { method: "GET", path: "/api/projects/[id]/export", desc: "导出本地工作区 ZIP" },
    ],
  },
  {
    title: "Community",
    rows: [
      { method: "GET", path: "/api/community/projects", desc: "公开列表（Publish Preview + listed）；无需登录" },
      { method: "GET", path: "/api/community/projects/[id]", desc: "社区项目摘要（已发布）" },
    ],
  },
  {
    title: "生成与修改",
    rows: [
      { method: "POST", path: "/api/ai", desc: "启动生成流水线（SSE，需 projectId）" },
      { method: "POST", path: "/api/ai/intent-agent", desc: "生成前 Intent Agent 对话轮次（SSE）" },
      { method: "POST", path: "/api/projects/[id]/modify", desc: "启动修改 Agent（SSE）" },
      { method: "GET", path: "/api/projects/[id]/memory", desc: "读取工作记忆投影 / 合并历史（调试）" },
    ],
  },
  {
    title: "Design Mode",
    rows: [
      { method: "POST", path: "/api/projects/[id]/design-mode/patch", desc: "Direct Apply：源坐标 + JSX AST 写盘（需 local preview + feature flag）" },
      { method: "POST", path: "/api/projects/[id]/design-mode/backfill", desc: "为历史源码补齐 data-ox-source 锚点" },
    ],
  },
  {
    title: "预览、封面与文件",
    rows: [
      { method: "POST", path: "/api/projects/[id]/preview", desc: "启动/刷新预览（local / storage / e2b 由环境决定）" },
      { method: "PUT", path: "/api/projects/[id]/preview", desc: "代码变更后增量重建预览" },
      { method: "GET", path: "/api/projects/[id]/preview", desc: "健康检查 + 自动恢复" },
      { method: "GET", path: "/api/projects/[id]/preview/status", desc: "沙箱 / 构建状态" },
      { method: "GET", path: "/api/projects/[id]/cover", desc: "封面图（未发布时非所有者不可访问）" },
      { method: "POST", path: "/api/projects/[id]/cover/capture", desc: "触发封面截图捕获" },
      { method: "GET", path: "/api/projects/[id]/files", desc: "列出 Storage 中的文件" },
      { method: "POST", path: "/api/projects/[id]/files", desc: "从 Storage 恢复到工作区" },
      { method: "PUT", path: "/api/projects/[id]/files", desc: "将工作区文件上传到 Storage" },
    ],
  },
  {
    title: "文件夹",
    rows: [
      { method: "GET", path: "/api/folders", desc: "当前用户的项目文件夹列表" },
      { method: "POST", path: "/api/folders", desc: "创建文件夹" },
      { method: "GET", path: "/api/folders/[id]", desc: "文件夹详情（含项目数）" },
      { method: "DELETE", path: "/api/folders/[id]", desc: "解散文件夹：项目移回根目录后删除文件夹行" },
    ],
  },
  {
    title: "模型与技能",
    rows: [
      { method: "GET", path: "/api/models", desc: "可用 LLM 模型列表（含 DB 自定义模型）" },
      { method: "GET", path: "/api/skills", desc: "风格技能 id / 标签（Hero「/」菜单）" },
    ],
  },
  {
    title: "会话与认证",
    rows: [
      { method: "GET", path: "/api/auth/user", desc: "当前登录用户（含 user_metadata）" },
      { method: "GET", path: "/api/auth/config", desc: "当前启用的登录提供商（飞书 / Google）" },
      { method: "GET", path: "/api/auth/feishu/start", desc: "飞书 OAuth 授权跳转" },
      { method: "GET", path: "/api/auth/feishu/callback", desc: "飞书 OAuth 回调，建立会话" },
      { method: "GET", path: "/api/auth/google/start", desc: "Google OAuth 授权跳转" },
    ],
  },
];

export default function DocsApiPage() {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">// docs / api</p>
      <h1 className="text-3xl font-bold tracking-tight">API 参考</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
        Open-OX Studio 的 HTTP 接口均为 Next.js Route Handlers，与前端同域。生成与修改类接口多为{" "}
        <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px]">
          text/event-stream
        </code>{" "}
        （SSE）。Workspace 默认私有；社区发现走独立 Community 路由。
      </p>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-[13px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.rows.map((row) => (
                <div
                  key={row.path + row.method}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card px-4 py-2.5 sm:flex-nowrap"
                >
                  <MethodBadge m={row.method} />
                  <code className="min-w-0 shrink-0 break-all text-[12px] font-mono text-foreground/85">{row.path}</code>
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground/80">{row.desc}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-primary/15 bg-primary/[0.04] px-5 py-4 text-[13px] text-muted-foreground">
        更完整的请求流程与数据流说明见{" "}
        <Link href="/docs/architecture#api" className="text-primary underline underline-offset-4 hover:text-primary/90">
          系统架构 → API 路由
        </Link>
        ；产品面划分见{" "}
        <Link href="/docs/architecture#surfaces" className="text-primary underline underline-offset-4 hover:text-primary/90">
          产品面
        </Link>
        。
      </div>

      <div className="mt-10 flex flex-wrap gap-6 border-t border-border pt-8">
        <Link
          href="/changelog"
          className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
        >
          更新日志 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/docs/pipeline" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
          AI 生成流水线 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
