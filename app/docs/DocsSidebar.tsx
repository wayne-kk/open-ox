"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    section: "快速开始",
    items: [
      { href: "/docs", label: "概览" },
      { href: "/docs/api", label: "API 参考" },
      { href: "/docs/architecture", label: "系统架构" },
      { href: "/docs/pipeline", label: "AI 生成流水线" },
      { href: "/docs/generate-project-trace", label: "Prompt 拼装 Trace" },
    ],
  },
  {
    section: "核心概念",
    items: [
      { href: "/docs/blueprint", label: "项目蓝图" },
      { href: "/docs/normalize", label: "Blueprint 容错解析" },
      { href: "/docs/design-system", label: "设计系统生成" },
      { href: "/docs/section-generation", label: "Section 生成" },
      { href: "/docs/skills", label: "风格技能" },
      { href: "/docs/modify-agent", label: "修改 Agent" },
    ],
  },
  {
    section: "基础设施",
    items: [
      { href: "/docs/preview", label: "预览沙箱" },
      { href: "/docs/storage", label: "存储与持久化" },
      { href: "/docs/models", label: "模型配置" },
    ],
  },
];

function linkActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-24 space-y-8">
        {NAV_ITEMS.map((group) => (
          <div key={group.section}>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = linkActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
