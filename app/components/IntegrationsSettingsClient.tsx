"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  FolderOpen,
  Loader2,
  Plug,
  Rocket,
  Unplug,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { vercelProjectDashboardUrl } from "@/lib/vercel/dashboardUrl";
import { notifyDeployTerminal } from "@/lib/vercel/deployNotify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConnectionState = {
  configured: boolean;
  connected: boolean;
  defaultTeamId: string | null;
  defaultTeamName: string | null;
  connectedAt: string | null;
};

type Team = { id: string; name: string; slug?: string };

type DeployStatus = "queued" | "building" | "uploading" | "ready" | "error";

type DeployRow = {
  projectId: string;
  projectName: string;
  status: DeployStatus | null;
  productionUrl: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  lastError: string | null;
  lastDeployedAt: string | null;
  deployId: string | null;
};

const ERROR_COPY: Record<string, string> = {
  vercel_config: "Vercel Integration 未配置（缺少环境变量）",
  vercel_denied: "已取消授权",
  vercel_state: "OAuth state 校验失败，请重试",
  vercel_user: "登录用户与发起连接的用户不一致",
  vercel_token: "换取 access token 失败",
  vercel_store: "保存连接失败",
};

const IN_PROGRESS: DeployStatus[] = ["queued", "building", "uploading"];

function statusLabel(status: DeployStatus | null): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "building":
      return "构建中";
    case "uploading":
      return "上传中";
    case "ready":
      return "已上线";
    case "error":
      return "失败";
    default:
      return "未知";
  }
}

function statusClass(status: DeployStatus | null): string {
  switch (status) {
    case "ready":
      return "text-emerald-200/90";
    case "error":
      return "text-red-300/90";
    case "queued":
    case "building":
    case "uploading":
      return "text-amber-200/90";
    default:
      return "text-muted-foreground";
  }
}

export function IntegrationsSettingsClient() {
  const t = useTranslations("settings");
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [redeployingId, setRedeployingId] = useState<string | null>(null);
  const [state, setState] = useState<ConnectionState>({
    configured: false,
    connected: false,
    defaultTeamId: null,
    defaultTeamName: null,
    connectedAt: null,
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [deployments, setDeployments] = useState<DeployRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<Map<string, DeployStatus | null>>(new Map());
  const statusToastReady = useRef(false);

  const refreshConnection = useCallback(async () => {
    const res = await fetch("/api/integrations/vercel", { credentials: "include" });
    const body = (await res.json()) as {
      configured?: boolean;
      connected?: boolean;
      defaultTeamId?: string | null;
      defaultTeamName?: string | null;
      connectedAt?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error ?? "加载连接失败");
    }
    const next: ConnectionState = {
      configured: body.configured !== false,
      connected: body.connected === true,
      defaultTeamId: body.defaultTeamId ?? null,
      defaultTeamName: body.defaultTeamName ?? null,
      connectedAt: body.connectedAt ?? null,
    };
    setState(next);

    if (next.connected) {
      const tRes = await fetch("/api/integrations/vercel/teams", { credentials: "include" });
      if (tRes.ok) {
        const tBody = (await tRes.json()) as { teams?: Team[] };
        setTeams(tBody.teams ?? []);
      }
    } else {
      setTeams([]);
    }
    return next;
  }, []);

  const refreshDeployments = useCallback(async () => {
    const res = await fetch("/api/integrations/vercel/deployments", {
      credentials: "include",
    });
    const body = (await res.json()) as {
      deployments?: DeployRow[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error ?? "加载部署列表失败");
    }
    const list = body.deployments ?? [];

    if (statusToastReady.current) {
      for (const row of list) {
        const prev = prevStatusRef.current.get(row.projectId);
        notifyDeployTerminal({
          projectLabel: row.projectName,
          prev,
          next: row.status,
          productionUrl: row.productionUrl,
          lastError: row.lastError,
        });
      }
    }
    const nextMap = new Map<string, DeployStatus | null>();
    for (const row of list) {
      nextMap.set(row.projectId, row.status);
    }
    prevStatusRef.current = nextMap;
    statusToastReady.current = true;
    setDeployments(list);
    return list;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conn = await refreshConnection();
      if (conn.connected) {
        await refreshDeployments();
      } else {
        setDeployments([]);
        prevStatusRef.current = new Map();
        statusToastReady.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, [refreshConnection, refreshDeployments]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      const msg = searchParams.get("msg");
      setError(ERROR_COPY[err] ?? err + (msg ? `: ${msg}` : ""));
    }
    if (searchParams.get("vercel") === "connected") {
      setMessage("已连接 Vercel");
      toast.success("已连接 Vercel");
    }
  }, [searchParams]);

  const anyInProgress = deployments.some(
    (d) => d.status != null && IN_PROGRESS.includes(d.status)
  );

  useEffect(() => {
    if (!state.connected || !anyInProgress) return;
    const t = window.setInterval(() => {
      void refreshDeployments().catch(() => {
        /* ignore transient poll errors */
      });
    }, 2500);
    return () => window.clearInterval(t);
  }, [state.connected, anyInProgress, refreshDeployments]);

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/vercel", {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "断开失败");
        return;
      }
      setMessage("已断开连接（未删除你在 Vercel 上的项目）");
      toast.message("已断开 Vercel", {
        description: "本页部署记录已清除；Vercel 上的站点仍然保留。",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setTeam = async (teamId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/vercel", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: teamId || null }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        defaultTeamId?: string | null;
        defaultTeamName?: string | null;
      };
      if (!res.ok) {
        setError(body.error ?? "更新 team 失败");
        return;
      }
      setState((s) => ({
        ...s,
        defaultTeamId: body.defaultTeamId ?? null,
        defaultTeamName: body.defaultTeamName ?? null,
      }));
      setMessage("已更新默认 Team");
    } finally {
      setBusy(false);
    }
  };

  const redeploy = async (projectId: string, projectName: string) => {
    setRedeployingId(projectId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: DeployStatus;
      };
      if (!res.ok) {
        toast.error(`${projectName} 无法开始部署`, {
          description: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.message(`${projectName} 部署已开始`, {
        description: "约 1–3 分钟，可继续使用；完成后会通知你。",
      });
      await refreshDeployments();
    } catch (e) {
      toast.error("网络错误", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRedeployingId(null);
    }
  };

  const teamSlug =
    teams.find((t) => t.id === state.defaultTeamId)?.slug ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground">
          {t("integrations")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("integrationsDescription")}
        </p>
      </header>

      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-100/90">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200/90">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : !state.configured ? (
        <section className="rounded-xl border border-border/60 bg-card/40 p-6">
          <p className="text-[13px] text-muted-foreground">
            当前环境未配置 Vercel Integration（需要{" "}
            <code className="font-mono text-[11px]">VERCEL_CLIENT_ID</code> 等）。
          </p>
        </section>
      ) : !state.connected ? (
        <section className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="space-y-1">
            <h2 className="text-[15px] font-medium text-foreground">连接 Vercel</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              授权后即可在 Studio 一键 Deploy，并在此查看线上 URL。
            </p>
          </div>
          <a
            href="/api/integrations/vercel/start?next=/settings/integrations"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-4 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/22"
            )}
          >
            <Plug className="h-4 w-4" />
            连接 Vercel
          </a>
          <p className="text-[12px] text-muted-foreground">
            也可以在 Studio 点 Deploy →「连接并 Deploy」，授权后会自动开始第一次部署。
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          <section className="rounded-xl border border-border/60 bg-card/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="font-medium text-foreground">Vercel</span>
                  <span className="text-emerald-200/90">已连接</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="truncate text-muted-foreground">
                    {state.defaultTeamName ?? state.defaultTeamId ?? "个人账号"}
                  </span>
                </div>
                {teams.length > 0 ? (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>默认 Team</span>
                    <select
                      className="max-w-[220px] rounded-md border border-border bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary/40"
                      value={state.defaultTeamId ?? ""}
                      disabled={busy}
                      onChange={(e) => void setTeam(e.target.value)}
                    >
                      <option value="">个人账号</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unplug className="h-3.5 w-3.5" />
                    )}
                    断开
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>断开 Vercel？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将清除 Open-OX 侧的授权与本页部署记录，之后无法在此查看 URL 或重新
                      Deploy。不会删除你在 Vercel 上的项目或线上站点。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void disconnect()}>
                      确认断开
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-medium text-foreground">我的部署</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  正在进行与已上线的站点；约 1–3 分钟，无需一直停留在此页。
                </p>
              </div>
            </div>

            {deployments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-card/20 px-5 py-8 text-center">
                <p className="text-[13px] text-muted-foreground">
                  还没有部署记录。打开一个项目，在 Studio 点 Deploy 即可。
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  去我的项目
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card/30">
                {deployments.map((row) => {
                  const inProgress =
                    row.status != null && IN_PROGRESS.includes(row.status);
                  const vercelHref = vercelProjectDashboardUrl({
                    vercelProjectName: row.vercelProjectName,
                    teamSlug,
                    teamName: state.defaultTeamName,
                  });
                  const busyRow = redeployingId === row.projectId;

                  return (
                    <li key={row.projectId} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {row.projectName}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px]",
                                statusClass(row.status)
                              )}
                            >
                              {inProgress ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : null}
                              {statusLabel(row.status)}
                            </span>
                          </div>

                          {row.productionUrl ? (
                            <a
                              href={row.productionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex max-w-full items-center gap-1 truncate text-[12px] text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{row.productionUrl}</span>
                            </a>
                          ) : (
                            <p className="text-[12px] text-muted-foreground/70">尚无生产 URL</p>
                          )}

                          {row.lastDeployedAt ? (
                            <p className="font-mono text-[10px] text-muted-foreground/65">
                              {new Date(row.lastDeployedAt).toLocaleString()}
                            </p>
                          ) : null}

                          {row.status === "error" && row.lastError ? (
                            <p className="max-w-xl text-[11px] leading-relaxed text-red-300/85">
                              {row.lastError.slice(0, 280)}
                              {row.lastError.length > 280 ? "…" : ""}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                          {row.productionUrl ? (
                            <a
                              href={row.productionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-white/20"
                            >
                              打开站点
                            </a>
                          ) : null}
                          <Link
                            href={`/studio/${encodeURIComponent(row.projectId)}`}
                            className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-white/20"
                          >
                            Studio
                          </Link>
                          <a
                            href={vercelHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-white/20"
                          >
                            Vercel
                          </a>
                          <button
                            type="button"
                            disabled={busyRow || inProgress}
                            onClick={() => void redeploy(row.projectId, row.projectName)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors",
                              busyRow || inProgress
                                ? "cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground"
                                : "border-primary/35 bg-primary/12 text-primary hover:bg-primary/20"
                            )}
                          >
                            {busyRow || inProgress ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Rocket className="h-3 w-3" />
                            )}
                            重新 Deploy
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
