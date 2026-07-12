"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DeployStatus = "queued" | "building" | "uploading" | "ready" | "error";

type DeployState = {
  configured: boolean;
  connected: boolean;
  status: DeployStatus | null;
  productionUrl: string | null;
  lastError: string | null;
  deployId: string | null;
};

const IN_PROGRESS: DeployStatus[] = ["queued", "building", "uploading"];

function statusLabel(status: DeployStatus | null): string {
  switch (status) {
    case "queued":
      return "排队中…";
    case "building":
      return "构建静态站…";
    case "uploading":
      return "上传到 Vercel…";
    case "ready":
      return "已上线";
    case "error":
      return "部署失败";
    default:
      return "未部署";
  }
}

function vercelConnectHref(projectId: string): string {
  const next = `/studio/${encodeURIComponent(projectId)}?deploy=1`;
  return `/api/integrations/vercel/start?next=${encodeURIComponent(next)}`;
}

async function fetchVercelConnection(): Promise<{ configured: boolean; connected: boolean }> {
  try {
    const res = await fetch("/api/integrations/vercel", { credentials: "include" });
    if (!res.ok) return { configured: false, connected: false };
    const body = (await res.json()) as { configured?: boolean; connected?: boolean };
    return {
      configured: body.configured !== false,
      connected: body.connected === true,
    };
  } catch {
    return { configured: false, connected: false };
  }
}

async function fetchDeployStatus(projectId: string): Promise<Omit<DeployState, "connected">> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deploy`, {
    credentials: "include",
  });
  const body = (await res.json().catch(() => ({}))) as {
    configured?: boolean;
    status?: DeployStatus | null;
    productionUrl?: string | null;
    lastError?: string | null;
    deployId?: string | null;
    error?: string;
  };
  if (!res.ok) {
    return {
      configured: false,
      status: null,
      productionUrl: null,
      lastError: body.error ?? `状态请求失败（${res.status}）`,
      deployId: null,
    };
  }
  return {
    configured: body.configured !== false,
    status: body.status ?? null,
    productionUrl: body.productionUrl ?? null,
    lastError: body.lastError ?? null,
    deployId: body.deployId ?? null,
  };
}

export function StudioDeployMenu({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const autoDeployStarted = useRef(false);
  const [state, setState] = useState<DeployState>({
    configured: true,
    connected: false,
    status: null,
    productionUrl: null,
    lastError: null,
    deployId: null,
  });

  const refresh = useCallback(async () => {
    const [conn, deploy] = await Promise.all([
      fetchVercelConnection(),
      fetchDeployStatus(projectId),
    ]);
    const next: DeployState = {
      ...deploy,
      configured: conn.configured && deploy.configured,
      connected: conn.connected,
    };
    setState(next);
    setHydrated(true);
    return next;
  }, [projectId]);

  const startDeploy = useCallback(async () => {
    setBusy(true);
    setState((s) => ({ ...s, lastError: null, status: "queued" }));
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        status?: DeployStatus;
        productionUrl?: string | null;
        lastError?: string | null;
        deployId?: string | null;
      };
      if (!res.ok) {
        if (body.code === "VERCEL_NOT_CONNECTED") {
          window.location.href = vercelConnectHref(projectId);
          return;
        }
        setState((s) => ({
          ...s,
          status: "error",
          lastError: body.error ?? `部署失败（${res.status}）`,
        }));
        return;
      }
      setState((s) => ({
        ...s,
        connected: true,
        status: body.status ?? "queued",
        productionUrl: body.productionUrl ?? s.productionUrl,
        lastError: body.lastError ?? null,
        deployId: body.deployId ?? null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        lastError: e instanceof Error ? e.message : "网络错误",
      }));
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  // Prefetch status so the menu is ready; also drives post-OAuth auto-deploy.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    if (!state.status || !IN_PROGRESS.includes(state.status)) return;
    const t = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(t);
  }, [open, state.status, refresh]);

  // After OAuth: /studio/:id?deploy=1&vercel=connected → open menu + auto Deploy once.
  useEffect(() => {
    if (!hydrated) return;
    const wantDeploy = searchParams.get("deploy") === "1";
    if (!wantDeploy) return;

    setOpen(true);

    if (!state.configured) return;

    if (!state.connected) {
      // Cookie/session race: retry refresh once, else send back to OAuth.
      if (searchParams.get("vercel") === "connected" && !autoDeployStarted.current) {
        void refresh();
      }
      return;
    }

    if (autoDeployStarted.current) return;
    if (state.status && IN_PROGRESS.includes(state.status)) {
      autoDeployStarted.current = true;
      return;
    }

    autoDeployStarted.current = true;
    void startDeploy().finally(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("deploy");
      params.delete("vercel");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [
    hydrated,
    state.configured,
    state.connected,
    state.status,
    searchParams,
    pathname,
    router,
    refresh,
    startDeploy,
  ]);

  const inProgress = state.status != null && IN_PROGRESS.includes(state.status);
  const ready = state.status === "ready" && Boolean(state.productionUrl);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] transition-colors",
            ready
              ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/18"
              : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/15 hover:text-foreground"
          )}
        >
          <Rocket className="h-3 w-3" />
          Deploy
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[300px] border-white/10 bg-[#0c0f16] p-3 shadow-xl"
      >
        <div className="mb-2 space-y-0.5">
          <p className="text-[11px] font-medium text-foreground">部署到 Vercel</p>
          <p className="text-[10px] leading-relaxed text-muted-foreground/65">
            推送到你自己的 Vercel 账号（与社区 Publish Preview 无关）
          </p>
        </div>

        {!hydrated ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中…
          </div>
        ) : !state.configured ? (
          <p className="text-[11px] text-muted-foreground">
            服务端未配置 Vercel Integration。请联系管理员设置环境变量。
          </p>
        ) : !state.connected ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              授权你的 Vercel 账号后，将自动开始第一次 Deploy。
            </p>
            <a
              href={vercelConnectHref(projectId)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/35 bg-primary/15 px-3 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/22"
            >
              <Rocket className="h-3.5 w-3.5" />
              连接并 Deploy
            </a>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">状态</span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                {inProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {statusLabel(state.status)}
              </span>
            </div>

            {ready && state.productionUrl ? (
              <a
                href={state.productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 truncate text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{state.productionUrl}</span>
              </a>
            ) : null}

            {state.lastError ? (
              <p className="text-[10px] leading-relaxed text-red-400/90">{state.lastError}</p>
            ) : null}

            <button
              type="button"
              disabled={busy || inProgress}
              onClick={() => void startDeploy()}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors",
                busy || inProgress
                  ? "cursor-not-allowed border-white/8 bg-white/3 text-muted-foreground"
                  : "border-primary/35 bg-primary/15 text-primary hover:bg-primary/22"
              )}
            >
              {busy || inProgress ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  部署中…
                </>
              ) : ready ? (
                "重新 Deploy"
              ) : (
                "Deploy 到 Vercel"
              )}
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
