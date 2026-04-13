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
  { id: "layers", label: "双层存储" },
  { id: "supabase-db", label: "Supabase DB" },
  { id: "supabase-storage", label: "Supabase Storage" },
  { id: "upload", label: "上传策略" },
  { id: "restore", label: "文件恢复" },
  { id: "lifecycle", label: "生命周期" },
];

export default function StoragePage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / storage
        </p>
        <h1 className="text-3xl font-bold tracking-tight">存储与持久化</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          项目数据分两层存储：Supabase PostgreSQL 保存元数据和修改历史，
          Supabase Storage 保存生成的源文件。本地 <Code>sites/</Code> 目录是工作区，
          Storage 是持久化备份。
        </p>

        <section id="layers" className="scroll-mt-24">
          <H2>双层存储</H2>
          <Pre>{`┌─────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                    │
│  projects 表：元数据、状态、blueprint、修改历史      │
│  model_configs 表：用户自定义模型配置               │
└──────────────────────┬──────────────────────────────┘
                       │ 文件路径引用
┌──────────────────────▼──────────────────────────────┐
│              Supabase Storage                       │
│  bucket: project-files                              │
│  路径: {projectId}/{relativePath}                   │
│  内容: 所有生成的 TSX、CSS、配置文件                │
└──────────────────────┬──────────────────────────────┘
                       │ 恢复到本地
┌──────────────────────▼──────────────────────────────┐
│              本地 sites/ 目录                       │
│  sites/{projectId}/                                 │
│  AI 引擎读写、E2B 沙箱上传的工作区                  │
└─────────────────────────────────────────────────────┘`}</Pre>
          <P>
            本地文件系统是临时工作区，服务器重启后可能丢失。
            Storage 是持久化层，确保项目文件跨 session 可恢复。
          </P>
        </section>

        <section id="supabase-db" className="scroll-mt-24">
          <H2>Supabase DB</H2>
          <P><Code>projects</Code> 表保存项目的完整生命周期数据：</P>
          <Pre>{`-- projects 表核心字段
id              TEXT PRIMARY KEY   -- 时间戳_slug 格式
user_id         UUID               -- 所有者（auth.users）
owner_username  TEXT               -- 创建时写入，用于全员列表展示 / 分组
folder_id       UUID               -- 可选，单层文件夹 project_folders.id
name            TEXT               -- 用户可编辑的项目名
status          TEXT               -- generating | ready | failed
blueprint       JSONB              -- ProjectBlueprint（含 PlannedProjectBlueprint）
buildSteps      JSONB[]            -- 每个流水线步骤的状态和产物
modificationHistory JSONB[]        -- 每次修改的完整记录
verificationStatus  TEXT           -- passed | failed | unverified
sandbox_id      TEXT               -- E2B 沙箱 ID（用于重连）
created_at      TIMESTAMPTZ`}</Pre>
          <H3>modificationHistory 结构</H3>
          <P>每条修改记录包含完整的 Agent 执行轨迹：</P>
          <Pre>{`ModificationRecord {
  instruction: string          // 用户指令原文
  modifiedAt: string           // ISO 时间戳
  touchedFiles: string[]       // 修改的文件列表
  plan: {
    analysis: string           // Agent 的分析摘要
    changes: Change[]          // 每个文件的变更说明
  }
  diffs: FileDiff[]            // 完整的 unified diff
  toolCalls: ToolCall[]        // Agent 调用的工具序列（截断到 500 字符）
  thinking: string[]           // Agent 的思考过程（截断到 500 字符）
  image: string | null         // 用户上传的截图（base64，最多 200KB）
}`}</Pre>
          <Callout>
            <Code>toolCalls</Code> 和 <Code>thinking</Code> 字段用于对话记忆。
            下次修改时，Agent 可以看到"上次改了哪些文件、用了哪些工具"，
            从而理解用户的跟进指令（如"再把那个按钮改大一点"）。
          </Callout>
        </section>

        <section id="supabase-storage" className="scroll-mt-24">
          <H2>Supabase Storage</H2>
          <P>
            所有生成的源文件存储在 <Code>project-files</Code> bucket 中，
            路径格式为 <Code>{"{projectId}/{relativePath}"}</Code>：
          </P>
          <Pre>{`project-files/
└── 1735123456789_my-saas/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── sections/
    │       ├── home_HeroSection.tsx
    │       ├── home_FeaturesSection.tsx
    │       └── layout_NavSection.tsx
    ├── design-system.md
    └── package.json`}</Pre>
          <P>
            跳过上传的目录：<Code>node_modules/</Code>、<Code>.next/</Code>、<Code>.git/</Code>。
            这些可以在恢复后重新生成，不需要持久化。
          </P>
        </section>

        <section id="upload" className="scroll-mt-24">
          <H2>上传策略</H2>
          <P>
            生成完成后，<Code>uploadGeneratedFiles</Code> 并行上传所有生成文件：
          </P>
          <Pre>{`// 并行上传，失败不阻塞（Promise.allSettled）
export async function uploadGeneratedFiles(
  projectId: string,
  generatedFiles: string[]
): Promise<void> {
  await Promise.allSettled(
    generatedFiles.map((f) => uploadProjectFile(projectId, f))
  );
}

// 单文件上传：读取本地 → upsert 到 Storage
export async function uploadProjectFile(
  projectId: string,
  relativeFilePath: string
): Promise<void> {
  const localPath = path.join(getSiteRoot(projectId), relativeFilePath);
  const content = await fs.readFile(localPath);
  await supabase.storage
    .from("project-files")
    .upload(\`\${projectId}/\${relativeFilePath}\`, content, { upsert: true });
}`}</Pre>
          <Callout type="warn">
            使用 <Code>Promise.allSettled</Code> 而非 <Code>Promise.all</Code>，
            单个文件上传失败不会中断整个批次。失败的文件会在下次修改时重新上传。
          </Callout>
        </section>

        <section id="restore" className="scroll-mt-24">
          <H2>文件恢复</H2>
          <P>
            当本地 <Code>sites/{"{projectId}"}/</Code> 目录不存在时（服务器重启、新实例），
            <Code>restoreProjectFiles</Code> 从 Storage 恢复所有文件：
          </P>
          <Pre>{`export async function restoreProjectFiles(projectId: string): Promise<string[]> {
  // 1. 递归列出 Storage 中的所有文件
  const allPaths = await listAllFiles(projectId);
  if (allPaths.length === 0) return [];

  // 2. 并行下载，自动创建目录
  await Promise.all(
    allPaths.map(async (storagePath) => {
      const { data } = await supabase.storage
        .from("project-files")
        .download(storagePath);

      const relativePath = storagePath.slice(projectId.length + 1);
      const localPath = path.join(getSiteRoot(projectId), relativePath);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, Buffer.from(await data.arrayBuffer()));
    })
  );

  return restored;
}`}</Pre>
          <H3>递归列目录</H3>
          <P>
            Supabase Storage 的 <Code>list()</Code> API 不支持递归，
            需要手动实现深度优先遍历：
          </P>
          <Pre>{`async function listAllFiles(prefix: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(currentPrefix: string) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(currentPrefix, { limit: 1000 });

    for (const item of data) {
      const fullPath = \`\${currentPrefix}/\${item.name}\`;
      if (item.id) result.push(fullPath);  // 文件（有 id）
      else await walk(fullPath);            // 目录（无 id）→ 递归
    }
  }
  await walk(prefix);
  return result;
}`}</Pre>
        </section>

        <section id="lifecycle" className="scroll-mt-24">
          <H2>生命周期</H2>
          <div className="mt-4 space-y-2">
            {[
              { event: "项目创建", action: "写入 projects 表，status=generating" },
              { event: "生成完成", action: "上传所有生成文件到 Storage，status=ready" },
              { event: "修改完成", action: "上传修改的文件，追加 modificationHistory" },
              { event: "预览启动", action: "从 Storage 恢复文件（如本地不存在），写入 sandbox_id" },
              { event: "项目删除", action: "删除 Storage 中所有文件，删除 projects 表记录，清理本地目录" },
            ].map(({ event, action }) => (
              <div key={event} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <span className="shrink-0 text-[12px] font-medium text-foreground/80 w-28">{event}</span>
                <span className="text-[12px] text-muted-foreground/70">{action}</span>
              </div>
            ))}
          </div>
          <Callout>
            删除操作分批执行（每批最多 1000 个路径），符合 Supabase Storage API 的限制。
            Storage 清理和 DB 记录删除是独立操作，Storage 失败不会阻止 DB 删除。
          </Callout>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/preview" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 预览沙箱
          </Link>
          <Link href="/docs/models" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            模型配置 <ArrowRight className="h-3.5 w-3.5" />
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
