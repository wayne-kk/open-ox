import Link from "next/link";
import { BookOpen, Cpu, GitBranch, Layers, Zap, ArrowUpRight } from "lucide-react";

const NAV_ITEMS = [
  {
    section: "快速开始",
    items: [
      { href: "/docs", label: "概览" },
      { href: "/docs/architecture", label: "系统架构" },
      { href: "/docs/pipeline", label: "AI 生成流水线" },
    ],
  },
  {
    section: "核心概念",
    items: [
      { href: "/docs/blueprint", label: "项目蓝图" },
      { href: "/docs/skills", label: "风格技能" },
      { href: "/docs/modify-agent", label: "修改 Agent" },
    ],
  },
  {
    section: "基础设施",
    items: [
      { href: "/docs/preview", label: "预览沙箱" },
      { href: "/docs/models", label: "模型配置" },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen pt-[57px]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex gap-12 py-10">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-8">
              {NAV_ITEMS.map((group) => (
                <div key={group.section}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
                    {group.section}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="border-t border-white/8 pt-6">
                <Link
                  href="/changelog"
                  className="flex items-center gap-2 text-[12px] text-muted-foreground/60 hover:text-primary transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  更新日志
                </Link>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
