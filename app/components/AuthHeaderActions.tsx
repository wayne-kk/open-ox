"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, LogOut, Shield, FileText } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getUserDisplayName,
  isPlaceholderAccountEmail,
} from "@/lib/auth/display-name";

export { getUserDisplayName, isPlaceholderAccountEmail };

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, ready };
}

/** 用于菜单副标题：优先展示真实邮箱（含 metadata 里飞书返回的企业邮箱），不展示占位邮箱 */
export function getUserAccountSubtitle(user: User): string | null {
  const m = user.user_metadata as Record<string, unknown>;
  const metaEmail = typeof m.email === "string" ? m.email.trim() : "";
  if (metaEmail && !isPlaceholderAccountEmail(metaEmail)) return metaEmail;
  const primary = user.email ?? "";
  if (primary && !isPlaceholderAccountEmail(primary)) return primary;
  return null;
}

function avatarFromUser(user: User): { src: string | null; initials: string } {
  const m = user.user_metadata as Record<string, unknown>;
  const src =
    (typeof m.avatar_url === "string" && m.avatar_url) ||
    (typeof m.picture === "string" && m.picture) ||
    null;
  const name = getUserDisplayName(user);
  const initials =
    name
      .replace(/[^\p{L}\p{N}]/gu, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  return { src, initials: initials.length ? initials : "?" };
}

export function UserAvatarButton({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const { src, initials } = avatarFromUser(user);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URLs
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-[11px] font-semibold text-primary">{initials}</span>
      )}
    </span>
  );
}

export function UserMenuDropdown({
  user,
  afterSignOut = "home",
}: {
  user: User;
  afterSignOut?: "home" | "auth";
}) {
  const router = useRouter();
  const displayName = getUserDisplayName(user);
  const subtitle = getUserAccountSubtitle(user);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/user")
      .then((res) => res.json())
      .then((data: { isAdmin?: boolean }) => {
        if (active) setIsAdmin(data.isAdmin === true);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    // local：只清当前浏览器会话，不额外请求 Supabase 撤销 token，退出更快
    await supabase.auth.signOut({ scope: "local" });
    const target = afterSignOut === "auth" ? "/auth" : "/";
    // 不要用 router.refresh()：会整树重算 RSC，体感很慢；replace 后由目标页自然拉新数据即可
    router.replace(target);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-9 max-w-[min(100vw-8rem,220px)] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-0 pl-0.5 pr-2 outline-none transition-[border-color,background-color,box-shadow] hover:border-primary/35 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0 data-[state=open]:border-primary/30 data-[state=open]:bg-white/[0.08] data-[state=open]:[&_.nav-chevron]:rotate-180 md:h-10 md:pr-2.5"
          aria-label="账户菜单"
        >
          <UserAvatarButton
            user={user}
            className="h-8 w-8 ring-2 ring-primary/25 transition group-hover:ring-primary/40 md:h-9 md:w-9"
          />
          <span className="hidden min-w-0 max-w-[7rem] truncate text-left text-[13px] font-medium text-foreground/95 lg:inline">
            {displayName}
          </span>
          <ChevronDown className="nav-chevron hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[min(calc(100vw-1.5rem),166px)] overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/98 p-0 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <div className="relative border-b border-white/[0.08] bg-gradient-to-br from-primary/[0.12] via-transparent to-accent-tertiary/[0.06] px-3 py-3.5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(247,147,26,0.12),transparent)]" />
          <div className="relative flex gap-2.5">
            <UserAvatarButton
              user={user}
              className="h-10 w-10 shrink-0 ring-2 ring-primary/30 shadow-md shadow-black/20"
            />
            <div className="min-w-0 flex-1 space-y-1 pt-1">
              <p className="truncate text-[14px] font-semibold leading-tight tracking-tight text-foreground">
                {displayName}
              </p>
              {subtitle ? (
                <p className="truncate font-mono text-[11px] leading-relaxed text-muted-foreground/85">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="p-1.5">
          {isAdmin ? (
            <>
              <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-xl px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
                <Link href="/admin">
                  <Shield className="h-4 w-4 shrink-0 opacity-80" />
                  Admin
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-xl px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
                <Link href="/admin/prompts">
                  <FileText className="h-4 w-4 shrink-0 opacity-80" />
                  Prompt
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-white/10" />
            </>
          ) : null}
          <DropdownMenuItem
            onClick={() => void signOut()}
            className="cursor-pointer gap-2 rounded-xl px-3 py-2.5 text-[14px] leading-snug text-foreground/90 focus:bg-red-500/[0.12] focus:text-red-300 data-[highlighted]:bg-red-500/[0.12] data-[highlighted]:text-red-200"
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-80" />
            退出登录
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
