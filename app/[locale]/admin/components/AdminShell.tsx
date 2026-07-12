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
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "总览", icon: LayoutDashboard },
  { href: "/admin/analytics/engagement", label: "停留", icon: Clock },
  { href: "/admin/analytics/activation", label: "激活漏斗", icon: Filter },
  { href: "/admin/analytics/retention", label: "留存", icon: GitBranch },
  { href: "/admin/analytics/generation", label: "生成质量", icon: BarChart3 },
  { href: "/admin/analytics/cost", label: "成本", icon: DollarSign },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/projects", label: "项目", icon: FolderKanban },
  { href: "/admin/system/queue", label: "队列", icon: ListOrdered },
  { href: "/admin/system/alerts", label: "告警", icon: AlertTriangle },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl gap-6 px-4 py-8 lg:px-6">
      <aside className="hidden w-52 shrink-0 md:block">
        <div className="sticky top-24 space-y-4">
          <div className="flex items-center gap-2 px-2 text-sm font-medium text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Admin
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <a
            href="https://cloud.langfuse.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Activity className="h-4 w-4 shrink-0 opacity-80" />
            Langfuse
          </a>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
