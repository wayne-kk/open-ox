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
    <div
      className={`my-4 rounded-xl border px-5 py-4 text-[13px] leading-6 ${
        type === "warn"
          ? "border-accent-tertiary/20 bg-accent-tertiary/5 text-accent-tertiary/90"
          : "border-primary/20 bg-primary/5 text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

const TOC = [
  { id: "overview", label: "概览" },
  { id: "flow", label: "数据流" },
  { id: "direct", label: "Direct Apply" },
  { id: "modify", label: "Modify 出口" },
  { id: "flags", label: "开关与前提" },
];

export default function DesignModeDocsPage() {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">
          // docs / design-mode
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Design Mode</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          在 Studio live preview 里点选元素，微调文案与样式，并写回源码。
          定位靠编译期源坐标；写盘靠服务端 JSX AST（ADR-0001）。
        </p>

        <section id="overview" className="scroll-mt-24">
          <H2>概览</H2>
          <P>
            Preview DOM 不是源码。Design Mode 用编译期注入的 <Code>data-ox-source</Code>
            （<Code>file:line:col</Code>）把选中节点映射到唯一 JSX，再在服务端突变静态{" "}
            <Code>className</Code> / 静态文案。
          </P>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">能力</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["点选", "iframe bridge 采集带 source 的 VisualEdit"],
                  ["可调属性", "color · font-size · padding · border-radius · 静态文案"],
                  ["Direct Apply", "POST …/design-mode/patch → AST 写盘 → HMR"],
                  ["失败出口", "预填 Modify 草稿，用户确认后走 Agent"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary/80">{k}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground/70">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="flow" className="scroll-mt-24">
          <H2>数据流</H2>
          <Pre>{`Preview (instrumented next-dev)
  └── data-ox-source on DOM
  └── design-mode-bridge.js
        │  VisualEdit[] { source, tag, props… }
Studio  └── DesignModePreviewOverlay / useDesignMode
        │
        ├── Direct capable?
        │     yes → POST /api/projects/[id]/design-mode/patch
        │            snapshot → AST mutate → prettier → verify → hot refresh
        └── no / A-class fail
              → Modify draft prefill → user confirm → runModifyProject`}</Pre>
          <Callout>
            Preview 只负责采集，不写盘。唯一自动写盘路径是 Direct Apply；Modify 不是第二条的 Apply 适配器。
          </Callout>
        </section>

        <section id="direct" className="scroll-mt-24">
          <H2>Direct Apply</H2>
          <H3>定位</H3>
          <P>
            主键 = <Code>data-ox-source</Code>。无坐标或歧义时不猜，走预检失败 → Modify。
            遗留的 <Code>data-ox-id</Code> / ripgrep 不再作为主路径。
          </P>
          <H3>突变范围</H3>
          <P>
            服务端 JSX AST：静态字符串 <Code>className</Code>（Tailwind utility upsert）与静态 JSX 文本。
            动态表达式、条件渲染歧义 → 不写盘。
          </P>
          <H3>API</H3>
          <Pre>{`POST /api/projects/[id]/design-mode/patch
Body: { edits: VisualEdit[] }

POST /api/projects/[id]/design-mode/backfill
  → 为历史项目补齐源坐标锚点`}</Pre>
        </section>

        <section id="modify" className="scroll-mt-24">
          <H2>Modify 出口</H2>
          <P>
            静态 <Code>site-previews</Code>、非 local 后端、或 AST 无法安全突变时：
            Studio 把选中上下文预填进 Modify 输入，用户确认后走完整 Agent + build。
          </P>
        </section>

        <section id="flags" className="scroll-mt-24">
          <H2>开关与前提</H2>
          <Pre>{`NEXT_PUBLIC_STUDIO_DESIGN_MODE=1
OPEN_OX_PREVIEW_BACKEND=local   # Direct Apply 需要 local next-dev

# Direct Apply 关闭时返回 403 DIRECT_EDIT_DISABLED`}</Pre>
          <Callout type="warn">
            生产若默认 storage 静态预览，点选仍可采集并走 Modify 出口；Direct Apply 仅在 local 预览链路启用。
          </Callout>
        </section>

        <div className="mt-14 border-t border-border pt-8 flex justify-between">
          <Link
            href="/docs/architecture"
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 系统架构
          </Link>
          <Link
            href="/docs/modify-agent"
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-primary transition-colors"
          >
            修改 Agent <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </article>

      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">本页目录</p>
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
