import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
function Callout({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`my-4 rounded-xl border px-5 py-4 text-[13px] leading-6 ${type === "warn" ? "border-accent-tertiary/20 bg-accent-tertiary/5 text-accent-tertiary/90" : "border-primary/20 bg-primary/5 text-muted-foreground"}`}>
      {children}
    </div>
  );
}

const TOC = [
  { id: "why-static", label: "为什么静态导出" },
  { id: "startup", label: "启动流程" },
  { id: "rebuild", label: "增量重建" },
  { id: "trigger", label: "触发时机" },
  { id: "reconnect", label: "沙箱重连" },
];

export default function PreviewPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">// docs / preview</p>
        <h1 className="text-3xl font-bold tracking-tight">预览沙箱</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          基于 E2B Cloud Sandboxes 的云端预览系统。每个项目在隔离的 Node.js 环境中构建，
          通过静态导出 + <Code>npx serve</Code> 提供稳定的预览 URL。
        </p>

        <section id="why-static" className="scroll-mt-24">
          <H2>为什么选择静态导出</H2>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">方案</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">启动时间</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">资源占用</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">URL 稳定性</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["next dev", "15-30s", "高（持续运行）", "不稳定"],
                  ["next build + serve", "30-60s（首次）", "低（静态文件）", "稳定"],
                ].map(([plan, time, resource, stability]) => (
                  <tr key={plan} className="hover:bg-white/[0.015]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{plan}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{time}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{resource}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{stability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            静态导出后用 <Code>npx serve out -l 3000</Code> 提供服务，URL 永久有效，资源占用极低。
          </P>
        </section>

        <section id="startup" className="scroll-mt-24">
          <H2>启动流程</H2>
          <Pre>{`startDevServer(projectId)
│
├── 1. 查 Supabase sandbox_id → 尝试重连已有沙箱
│      ├── 沙箱存活 + server 运行 → 直接返回 URL（最快路径）
│      ├── 沙箱存活 + /out 存在 → 重启 serve
│      └── 沙箱不存在/已过期 → 创建新沙箱
│
├── 2. 创建 E2B 沙箱（模板：NEXTJS_TEMPLATE）
│      模板预装：Node.js、npm、Next.js 及所有基础依赖
│
├── 3. 批量上传项目文件（20 个/批，并行）
│      跳过：node_modules、.next、.git
│      特殊处理：package.json 使用模板版本（避免版本冲突）
│
├── 4. 注入 output: 'export' 到 next.config.ts
│      （静态导出必需，images.unoptimized: true）
│
├── 5. 智能依赖安装
│      对比项目 package.json 与模板 package.json
│      只安装模板中没有的新增依赖（大幅减少安装时间）
│
├── 6. next build → 静态导出到 /out
│
└── 7. npx serve out -l 3000（后台运行）
       等待 "Accepting connections" 输出
       返回 https://{sandbox.getHost(3000)}`}</Pre>
        </section>

        <section id="rebuild" className="scroll-mt-24">
          <H2>增量重建</H2>
          <P>修改完成后触发 <Code>rebuildDevServer</Code>，复用已有沙箱：</P>
          <Pre>{`rebuildDevServer(projectId)
├── 连接已有沙箱（不重建，节省 30s+）
├── kill 旧的 serve 进程
├── 重新上传修改的文件
├── 安装新增依赖（如有）
├── next build
└── 重启 serve`}</Pre>
          <Callout>
            重建复用已有沙箱是关键优化。创建新沙箱需要 30 秒以上（模板初始化 + 依赖安装），
            而重连只需几百毫秒。
          </Callout>
        </section>

        <section id="trigger" className="scroll-mt-24">
          <H2>触发时机</H2>
          <P>预览不是自动启动的，而是按需触发：</P>
          <div className="mt-4 space-y-2">
            {[
              { trigger: "用户点击 Preview 面板", api: "POST /api/projects/[id]/preview", desc: "首次启动沙箱" },
              { trigger: "修改完成后", api: "PUT /api/projects/[id]/preview", desc: "自动触发增量重建" },
              { trigger: "重新进入已有项目", api: "—", desc: "预览状态为 idle，等待用户主动点击" },
            ].map(({ trigger, api, desc }) => (
              <div key={trigger} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
                <span className="shrink-0 text-[12px] text-foreground/80 w-40">{trigger}</span>
                <code className="shrink-0 font-mono text-[10px] text-muted-foreground/50">{api}</code>
                <span className="text-[12px] text-muted-foreground/60">{desc}</span>
              </div>
            ))}
          </div>
          <P>
            这个设计避免了每次生成都启动 E2B 沙箱的资源浪费，只有用户真正需要预览时才消耗沙箱资源。
          </P>
        </section>

        <section id="reconnect" className="scroll-mt-24">
          <H2>沙箱重连</H2>
          <P>
            <Code>sandbox_id</Code> 持久化在 Supabase 的 projects 表中。
            下次请求预览时，系统先尝试用这个 ID 重连已有沙箱：
          </P>
          <Pre>{`// 重连逻辑
const sandbox = await Sandbox.connect(project.sandbox_id);
if (sandbox.isRunning) {
  // 检查 serve 进程是否还在
  // 如果在 → 直接返回 URL
  // 如果不在但 /out 存在 → 重启 serve
}
// 沙箱已过期 → 创建新沙箱，更新 sandbox_id`}</Pre>
          <Callout type="warn">
            E2B 沙箱有生命周期限制。长时间不活跃的沙箱会被回收，此时需要重新创建。
            但由于模板预装了所有基础依赖，重建速度仍然可接受。
          </Callout>
        </section>

        <div className="mt-14 border-t border-white/8 pt-8 flex justify-between">
          <Link href="/docs/modify-agent" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> 修改 Agent
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
              <li key={item.id}><a href={`#${item.id}`} className="block text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors py-0.5">{item.label}</a></li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
