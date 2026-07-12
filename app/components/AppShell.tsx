"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Folder,
  FolderOpen,
  Globe2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Sparkles,
  BookOpen,
  CreditCard,
  Plug,
  Palette,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthUser, UserMenuDropdown } from "@/app/components/AuthHeaderActions";
import {
  FOLDERS_CHANGED_EVENT,
  isRootFolderParam,
} from "@/lib/projectFolders";
import { BrandMark } from "@/app/components/BrandMark";
import { CreditsBalanceBadge } from "@/app/components/CreditsBalanceBadge";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const SIDEBAR_COLLAPSED_KEY = "open-ox:app-sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "open-ox:app-sidebar-width";
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 360;
const SIDEBAR_WIDTH_DEFAULT = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;
export const WORKSPACE_PROMPT_ID = "workspace-prompt";

function clampSidebarWidth(n: number) {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(n)));
}

type ProjectFolder = {
  id: string;
  name: string;
};

function focusWorkspacePrompt() {
  const root = document.getElementById(WORKSPACE_PROMPT_ID);
  root?.scrollIntoView({ behavior: "smooth", block: "start" });
  const textarea = root?.querySelector("textarea");
  if (textarea instanceof HTMLTextAreaElement) {
    window.setTimeout(() => textarea.focus(), 280);
  }
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
  newTab,
}: {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  /** Open in a new browser tab (docs / changelog leave the product shell). */
  newTab?: boolean;
}) {
  const className = cn(
    "flex w-full items-center rounded-lg py-2 text-left text-[13px] font-medium transition-[padding,background-color,color,box-shadow,gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    collapsed ? "justify-center gap-0 px-0" : "gap-2.5 px-2.5",
    active
      ? "bg-primary/15 text-primary shadow-[var(--box-shadow-neon-sm)]"
      : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
  );

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span
        className={cn(
          "truncate transition-[opacity,max-width,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "ml-0 max-w-0 opacity-0" : "min-w-0 flex-1 opacity-100"
        )}
      >
        {label}
      </span>
    </>
  );

  if (onClick && !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        title={collapsed ? label : undefined}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      onClick={onClick}
      className={className}
      title={collapsed ? label : undefined}
      aria-label={label}
      {...(newTab
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {content}
    </Link>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  foldersOpen,
  setFoldersOpen,
  folders,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  foldersOpen: boolean;
  setFoldersOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  folders: ProjectFolder[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("workspace");
  const tSettings = useTranslations("settings");
  const folderParam = searchParams.get("folder");
  const onDashboard = pathname === "/dashboard";
  const onCommunity = pathname === "/community" || pathname.startsWith("/community/");
  const onAppearance =
    pathname === "/settings/appearance" || pathname.startsWith("/settings/appearance/");
  const onIntegrations =
    pathname === "/settings/integrations" || pathname.startsWith("/settings/integrations");
  const onDashboardRoot = onDashboard && isRootFolderParam(folderParam);

  const handleStartBuild = () => {
    onNavigate?.();
    if (pathname === "/dashboard") {
      focusWorkspacePrompt();
      return;
    }
    router.push(`/dashboard#${WORKSPACE_PROMPT_ID}`);
  };

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${WORKSPACE_PROMPT_ID}`) {
      focusWorkspacePrompt();
    }
  }, [pathname]);

  return (
    <div className="flex h-full flex-col overflow-x-hidden">
      <div
        className={cn(
          "flex items-center px-2 transition-[padding] duration-300",
          collapsed ? "justify-center py-3 pb-10" : "py-5 pr-10"
        )}
      >
        <Link
          href="/home"
          onClick={onNavigate}
          className={cn(
            "group flex min-w-0 items-center overflow-hidden transition-[gap,justify-content] duration-300",
            collapsed ? "w-full justify-center gap-0" : "gap-2.5"
          )}
          aria-label={t("homeAria")}
        >
          <BrandMark size={collapsed ? 24 : 28} className="transition-[width,height] duration-300" />
          <span
            className={cn(
              "truncate font-heading text-[12px] font-bold tracking-[0.16em] text-foreground transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed ? "pointer-events-none max-w-0 overflow-hidden opacity-0" : "max-w-[120px] opacity-100"
            )}
            aria-hidden={collapsed}
          >
            OPEN-OX
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-3">
        <NavItem
          label={t("startBuild")}
          icon={Sparkles}
          collapsed={collapsed}
          onClick={handleStartBuild}
        />

        <div>
          <div
            className={cn(
              "flex items-center rounded-lg transition-[background-color,color,box-shadow,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed ? "justify-center px-0" : "pr-0.5",
              onDashboardRoot
                ? "bg-primary/15 text-primary shadow-[var(--box-shadow-neon-sm)]"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Link
              href="/dashboard?mine=1&folder=all"
              onClick={onNavigate}
              title={collapsed ? t("myProjects") : undefined}
              aria-label={t("myProjects")}
              aria-current={onDashboardRoot ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center py-2 text-[13px] font-medium transition-[gap,padding] duration-300",
                collapsed ? "justify-center gap-0 px-0" : "gap-2.5 px-2.5"
              )}
            >
              {onDashboardRoot ? (
                <FolderOpen className="h-4 w-4 shrink-0 opacity-90" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 opacity-90" />
              )}
              <span
                className={cn(
                  "truncate transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  collapsed ? "max-w-0 opacity-0" : "min-w-0 flex-1 opacity-100"
                )}
              >
                {t("myProjects")}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setFoldersOpen((v) => !v)}
              className={cn(
                "shrink-0 rounded-md p-1.5 transition-[opacity,max-width,padding,color] duration-300",
                onDashboardRoot
                  ? "text-primary/80 hover:bg-primary/10 hover:text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed
                  ? "pointer-events-none max-w-0 overflow-hidden p-0 opacity-0"
                  : "max-w-[32px] opacity-100"
              )}
              aria-label={foldersOpen ? t("foldersCollapse") : t("foldersExpand")}
              aria-expanded={foldersOpen}
              tabIndex={collapsed ? -1 : 0}
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  foldersOpen && "rotate-180"
                )}
              />
            </button>
          </div>

          <div
            className={cn(
              "ml-3 overflow-hidden border-l border-border pl-2 transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              !collapsed && foldersOpen
                ? "mt-0.5 max-h-64 opacity-100"
                : "mt-0 max-h-0 opacity-0"
            )}
          >
            <div className="space-y-0.5">
              {folders.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70">{t("noFolders")}</p>
              ) : (
                folders.map((f) => (
                  <Link
                    key={f.id}
                    href={`/dashboard?mine=1&folder=${encodeURIComponent(f.id)}`}
                    onClick={onNavigate}
                    className={cn(
                      "block truncate rounded-md px-2 py-1.5 text-[12px] transition-colors",
                      folderParam === f.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {f.name}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <NavItem
          href="/community"
          label={t("community")}
          icon={Globe2}
          active={onCommunity}
          collapsed={collapsed}
          onClick={onNavigate}
        />

        <div className={cn("my-2 border-t border-border/60", collapsed && "mx-1")} />

        <NavItem
          href="/settings/appearance"
          label={tSettings("navAppearance")}
          icon={Palette}
          active={onAppearance}
          collapsed={collapsed}
          onClick={onNavigate}
        />
        <NavItem
          href="/settings/integrations"
          label={tSettings("navIntegrations")}
          icon={Plug}
          active={onIntegrations}
          collapsed={collapsed}
          onClick={onNavigate}
        />
        <NavItem
          href="/pricing"
          label={t("pricing")}
          icon={CreditCard}
          collapsed={collapsed}
          onClick={onNavigate}
          newTab
        />
        <NavItem
          href="/docs"
          label={t("docs")}
          icon={BookOpen}
          collapsed={collapsed}
          onClick={onNavigate}
          newTab
        />
        <NavItem
          href="/changelog"
          label={t("changelog")}
          icon={ScrollText}
          collapsed={collapsed}
          onClick={onNavigate}
          newTab
        />
      </nav>
    </div>
  );
}

function SidebarBodySuspense(props: {
  collapsed: boolean;
  onNavigate?: () => void;
  foldersOpen: boolean;
  setFoldersOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  folders: ProjectFolder[];
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col px-2 py-3">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <SidebarBody {...props} />
    </Suspense>
  );
}

export function AppSidebar({
  collapsed,
  onCollapsedChange,
  width,
  onWidthChange,
  mobileOpen,
  onMobileOpenChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  width: number;
  onWidthChange: (v: number) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
}) {
  const { user, ready } = useAuthUser();
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/folders");
        if (!res.ok || cancelled) return;
        setFolders((await res.json()) as ProjectFolder[]);
      } catch {
        /* ignore */
      }
    };
    void load();
    const onChanged = () => void load();
    window.addEventListener(FOLDERS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(FOLDERS_CHANGED_EVENT, onChanged);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onCollapsedChange(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      onWidthChange(clampSidebarWidth(drag.startWidth + (e.clientX - drag.startX)));
    };
    const onUp = () => {
      dragRef.current = null;
      setResizing(false);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [resizing, onWidthChange]);

  const startResize = (e: React.PointerEvent) => {
    if (collapsed || e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onResizeKeyDown = (e: React.KeyboardEvent) => {
    if (collapsed) return;
    const step = e.shiftKey ? 24 : 8;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onWidthChange(clampSidebarWidth(width - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onWidthChange(clampSidebarWidth(width + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onWidthChange(SIDEBAR_WIDTH_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onWidthChange(SIDEBAR_WIDTH_MAX);
    }
  };

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : width;

  const userSlot = (
    <div className={cn("border-t border-border/60 p-2", collapsed && "flex justify-center")}>
      {!ready ? (
        <div
          className={cn(
            "animate-pulse rounded-xl bg-muted",
            collapsed ? "h-10 w-10" : "h-10 w-full"
          )}
        />
      ) : user ? (
        <div className={cn("flex flex-col gap-1.5", collapsed && "items-center")}>
          {!collapsed ? <CreditsBalanceBadge className="mx-0.5 self-start" /> : null}
          <UserMenuDropdown
            user={user}
            afterSignOut="home"
            variant="sidebar"
            collapsed={collapsed}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "app-sidebar-surface relative sticky top-0 z-20 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border md:flex",
          !resizing && "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        )}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            "absolute z-20 rounded-sm p-1.5 text-muted-foreground transition-[top,left,right,transform,background-color,color] duration-300 hover:bg-primary/10 hover:text-primary hover:shadow-[var(--box-shadow-neon-sm)]",
            collapsed
              ? "left-1/2 top-12 -translate-x-1/2"
              : "right-2 top-5 translate-x-0"
          )}
          aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <div className="relative z-[1] min-h-0 flex-1 overflow-hidden">
          <SidebarBodySuspense
            collapsed={collapsed}
            foldersOpen={foldersOpen}
            setFoldersOpen={setFoldersOpen}
            folders={folders}
          />
        </div>
        <div
          className={cn(
            "relative z-[1] border-t border-border/60 p-2 transition-[padding] duration-300",
            collapsed && "flex justify-center"
          )}
        >
          {!ready ? (
            <div
              className={cn(
                "animate-pulse rounded-xl bg-muted",
                collapsed ? "h-10 w-10" : "h-10 w-full"
              )}
            />
          ) : user ? (
            <div className={cn("flex flex-col gap-1.5", collapsed && "items-center")}>
              {!collapsed ? <CreditsBalanceBadge className="mx-0.5 self-start" /> : null}
              <UserMenuDropdown
                user={user}
                afterSignOut="home"
                variant="sidebar"
                collapsed={collapsed}
              />
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整侧栏宽度"
            aria-valuemin={SIDEBAR_WIDTH_MIN}
            aria-valuemax={SIDEBAR_WIDTH_MAX}
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={onResizeKeyDown}
            className={cn(
              "absolute inset-y-0 right-0 z-30 w-1.5 translate-x-1/2 cursor-col-resize touch-none",
              "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
              "hover:after:bg-primary/50 focus-visible:outline-none focus-visible:after:bg-primary",
              resizing && "after:bg-primary"
            )}
          />
        ) : null}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-2 border-b border-sidebar-border bg-background/95 px-3 backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => onMobileOpenChange(true)}
          className="rounded-sm p-2 text-muted-foreground hover:text-primary"
          aria-label="打开菜单"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link href="/home" className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="font-heading text-[11px] font-bold tracking-[0.16em]">OPEN-OX</span>
        </Link>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="关闭菜单"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="app-sidebar-surface absolute left-0 top-0 flex h-full w-[min(100vw-3rem,16rem)] flex-col border-r border-sidebar-border shadow-2xl">
            <div className="relative z-[1] flex items-center justify-end p-2">
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label="关闭菜单"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative z-[1] min-h-0 flex-1">
              <SidebarBodySuspense
                collapsed={false}
                onNavigate={() => onMobileOpenChange(false)}
                foldersOpen={foldersOpen}
                setFoldersOpen={setFoldersOpen}
                folders={folders}
              />
            </div>
            <div className="relative z-[1]">{userSlot}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setCollapsed(true);
      const rawWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (rawWidth) {
        const parsed = Number(rawWidth);
        if (Number.isFinite(parsed)) setWidth(clampSidebarWidth(parsed));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onCollapsedChange = useCallback((v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const onWidthChange = useCallback((v: number) => {
    const next = clampSidebarWidth(v);
    setWidth(next);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        width={width}
        onWidthChange={onWidthChange}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="relative min-w-0 flex-1 overflow-x-hidden pt-12 md:pt-0">
        <div className="relative z-[1]">{children}</div>
      </div>
    </div>
  );
}

/** Shell only after auth is ready and the user is signed in; otherwise pass-through. */
export function AuthAwareAppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuthUser();
  if (!ready || !user) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
