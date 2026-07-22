"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  DollarSign,
  Filter,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_GROUPS: Array<{ label: string; items: AdminNavItem[] }> = [
  {
    label: "概览",
    items: [{ href: "/admin/dashboard", label: "总览", icon: LayoutDashboard }],
  },
  {
    label: "业务分析",
    items: [
      { href: "/admin/analytics/acquisition", label: "获客", icon: Megaphone },
      { href: "/admin/analytics/activation", label: "激活漏斗", icon: Filter },
      { href: "/admin/analytics/engagement", label: "停留", icon: Clock },
      { href: "/admin/analytics/retention", label: "留存", icon: GitBranch },
      {
        href: "/admin/analytics/generation",
        label: "生成质量",
        icon: BarChart3,
      },
      { href: "/admin/analytics/cost", label: "成本", icon: DollarSign },
    ],
  },
  {
    label: "运营",
    items: [
      { href: "/admin/users", label: "用户", icon: Users },
      { href: "/admin/projects", label: "项目", icon: FolderKanban },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/admin/system/queue", label: "队列", icon: ListOrdered },
      { href: "/admin/system/alerts", label: "告警", icon: AlertTriangle },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const adminPathIndex = pathname.indexOf("/admin");
  const activePath =
    adminPathIndex >= 0 ? pathname.slice(adminPathIndex) : pathname;

  const isActive = (href: string) =>
    activePath === href || activePath.startsWith(`${href}/`);

  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1440px] overflow-x-hidden px-4 py-5 lg:px-6 lg:py-7">
      <nav className="mb-5 flex max-w-full gap-1 overflow-x-auto border-y border-border bg-background/95 py-2 md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs",
              isActive(href)
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex gap-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <div className="sticky top-20">
            <div className="mb-5 flex items-center gap-2 px-2 text-sm font-semibold text-foreground">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
                <Shield className="h-4 w-4" />
              </span>
              管理后台
            </div>
            <nav className="space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground/70">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
                          isActive(href)
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-80" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <a
              href="https://cloud.langfuse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 border-t border-border px-2.5 pt-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <Activity className="h-4 w-4 shrink-0 opacity-80" />
              Langfuse
            </a>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
