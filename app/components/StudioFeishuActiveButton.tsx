"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ActiveState = {
  projectId: string | null;
  projectName: string | null;
};

async function fetchActive(): Promise<ActiveState> {
  const res = await fetch("/api/feishu/active-project", { credentials: "include" });
  if (!res.ok) return { projectId: null, projectName: null };
  const body = (await res.json()) as ActiveState;
  return {
    projectId: typeof body.projectId === "string" ? body.projectId : null,
    projectName: typeof body.projectName === "string" ? body.projectName : null,
  };
}

async function launchFeishu(projectId: string): Promise<{
  ok: boolean;
  needLogin?: boolean;
  loginUrl?: string;
  botUrl?: string;
  projectName?: string | null;
  error?: string;
}> {
  const res = await fetch("/api/feishu/launch", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    needFeishuLogin?: boolean;
    loginUrl?: string;
    botUrl?: string;
    projectName?: string | null;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error || "无法启动飞书改站" };
  }
  if (body.needFeishuLogin && body.loginUrl) {
    return { ok: true, needLogin: true, loginUrl: body.loginUrl };
  }
  if (!body.botUrl) {
    return { ok: false, error: "未返回飞书机器人链接" };
  }
  return {
    ok: true,
    botUrl: body.botUrl,
    projectName: body.projectName,
  };
}

/**
 * Studio one-shot: bind identity + set current project + open Feishu bot.
 */
export function StudioFeishuActiveButton({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isActive = activeId === projectId;

  const runLaunch = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await launchFeishu(projectId);
      if (!result.ok) {
        toast.error(result.error || "无法启动飞书改站");
        return;
      }
      if (result.needLogin && result.loginUrl) {
        toast.message("需要飞书登录，正在跳转…");
        window.location.href = result.loginUrl;
        return;
      }
      if (result.botUrl) {
        setActiveId(projectId);
        toast.success(
          result.projectName
            ? `已绑定「${result.projectName}」，正在打开飞书…`
            : "正在打开飞书机器人…"
        );
        window.open(result.botUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("无法启动飞书改站");
    } finally {
      setBusy(false);
    }
  }, [busy, projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const active = await fetchActive();
      if (!cancelled) {
        setActiveId(active.projectId);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // After Feishu OAuth return (?feishu_launch=1), auto-open bot once.
  useEffect(() => {
    if (!loaded) return;
    if (searchParams.get("feishu_launch") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("feishu_launch");
    window.history.replaceState({}, "", url.pathname + url.search);
    void runLaunch();
    // intentionally once when loaded + query present
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, searchParams]);

  if (!loaded) return null;

  return (
    <button
      type="button"
      onClick={() => void runLaunch()}
      disabled={busy}
      title="绑定当前项目并用飞书改站（自动打开机器人）"
      aria-label="在飞书中改"
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[10px] tracking-[0.08em] transition-colors",
        isActive
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground/70 hover:border-border hover:text-foreground",
        busy && "opacity-60"
      )}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{isActive ? "飞书·改" : "飞书改"}</span>
    </button>
  );
}
