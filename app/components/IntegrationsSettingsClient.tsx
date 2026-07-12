"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plug,
  Rocket,
  Unplug,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  openOxVercelReconnectHref,
  vercelIntegrationPermissionsDocsUrl,
  vercelIntegrationsDashboardUrl,
  vercelProjectDashboardUrl,
  vercelTeamIntegrationsUrl,
} from "@/lib/vercel/dashboardUrl";
import { deployHelpLinks, type DeployHelpLink } from "@/lib/vercel/deployHelp";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      return "text-emerald-300/90";
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

function teamDisplayName(state: ConnectionState): string {
  const name = state.defaultTeamName?.trim();
  if (name) return name;
  const id = state.defaultTeamId?.trim();
  if (id) return id.length > 18 ? `${id.slice(0, 12)}…` : id;
  return "个人账号";
}

function displayHost(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function HelpLinksList({
  links,
  className,
}: {
  links: DeployHelpLink[];
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {links.map((link) =>
        link.external ? (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
              {link.label}
            </a>
          </li>
        ) : (
          <li key={link.id}>
            <a
              href={link.href}
              className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
            >
              <Plug className="h-3 w-3 shrink-0 opacity-80" />
              {link.label}
            </a>
          </li>
        )
      )}
    </ul>
  );
}

type GuideStep = {
  n: string;
  title: string;
  body: string;
  tips?: string[];
  actions?: Array<{ label: string; href: string; external?: boolean; primary?: boolean }>;
};

function useGuideSteps(connected: boolean, teamSlug: string | null): GuideStep[] {
  const teamIntegrations = vercelTeamIntegrationsUrl(teamSlug);
  return [
    {
      n: "1",
      title: "连接 Vercel 并选择 Team",
      body: "在 Vercel 授权页选择你有「创建项目」权限的 Team（Owner 或 Member，不要选 Viewer）。",
      tips: ["个人 Hobby 账号也可；选了 Team 后 Deploy 都会落在该 Team。"],
      actions: [
        {
          label: connected ? "重新授权" : "连接 Vercel",
          href: openOxVercelReconnectHref(),
          primary: true,
        },
      ],
    },
    {
      n: "2",
      title: "确认 Integration 可创建项目",
      body: "Vercel → Integrations → 本应用 → Manage。项目访问设为 All projects（或允许新建），并具备 Project 写入。",
      tips: ["报「没有权限创建项目」时，几乎都是这一步。"],
      actions: [
        {
          label: "打开 Integrations",
          href: teamIntegrations ?? vercelIntegrationsDashboardUrl(),
          external: true,
          primary: true,
        },
        {
          label: "权限文档",
          href: vercelIntegrationPermissionsDocsUrl(),
          external: true,
        },
      ],
    },
    {
      n: "3",
      title: "在 Studio 点 Deploy",
      body: "打开项目 → Studio 顶栏 Deploy。首次约 1–3 分钟，可离开页面。",
      actions: [{ label: "去我的项目", href: "/dashboard?mine=1" }],
    },
    {
      n: "4",
      title: "回到本页查看生产 URL",
      body: "成功后会出现线上地址。可打开站点、回 Studio 修改，或重新 Deploy。",
      tips: ["本页 Deploy ≠ 社区 Publish Preview。"],
    },
  ];
}

function GuideStepsList({
  connected,
  teamSlug,
}: {
  connected: boolean;
  teamSlug: string | null;
}) {
  const steps = useGuideSteps(connected, teamSlug);
  return (
    <ol className="space-y-6">
      {steps.map((step, i) => (
        <li key={step.n} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/12 font-mono text-[11px] text-muted-foreground">
            {step.n}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-medium text-foreground">{step.title}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{step.body}</p>
            {step.tips?.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {step.tips.map((tip) => (
                  <li key={tip} className="text-[11px] text-muted-foreground/70">
                    · {tip}
                  </li>
                ))}
              </ul>
            ) : null}
            {step.actions?.length ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {step.actions.map((action) =>
                  action.external ? (
                    <a
                      key={action.label}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors",
                        action.primary
                          ? "bg-primary/15 text-primary hover:bg-primary/22"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {action.label}
                    </a>
                  ) : (
                    <a
                      key={action.label}
                      href={action.href}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors",
                        action.primary
                          ? "bg-primary/15 text-primary hover:bg-primary/22"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {i === 0 ? <Plug className="h-3 w-3" /> : <FolderOpen className="h-3 w-3" />}
                      {action.label}
                    </a>
                  )
                )}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Quiet help block — not a competing card when deployments are the main surface. */
function SetupHelp({
  connected,
  teamSlug,
  defaultOpen,
  prominent,
}: {
  connected: boolean;
  teamSlug: string | null;
  defaultOpen: boolean;
  /** Full panel for disconnected onboarding; quiet disclosure when connected. */
  prominent: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (prominent) {
    return (
      <section className="space-y-5">
        <div>
          <h2 className="text-[13px] font-medium text-foreground">配置步骤</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            按顺序完成即可开始 Deploy
          </p>
        </div>
        <GuideStepsList connected={connected} teamSlug={teamSlug} />
      </section>
    );
  }

  return (
    <section className="border-t border-white/8 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          配置与排错
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/70 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="mt-5">
          <GuideStepsList connected={connected} teamSlug={teamSlug} />
        </div>
      ) : null}
    </section>
  );
}

function DeployRowCard({
  row,
  teamSlug,
  teamName,
  busyRow,
  onRedeploy,
}: {
  row: DeployRow;
  teamSlug: string | null;
  teamName: string | null;
  busyRow: boolean;
  onRedeploy: () => void;
}) {
  const [errorOpen, setErrorOpen] = useState(row.status === "error");
  const inProgress = row.status != null && IN_PROGRESS.includes(row.status);
  const vercelHref = vercelProjectDashboardUrl({
    vercelProjectName: row.vercelProjectName,
    teamSlug,
    teamName,
  });
  const hasError = row.status === "error" && Boolean(row.lastError);
  const helpLinks = hasError
    ? deployHelpLinks({ error: row.lastError, teamSlug })
    : [];

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="truncate text-[14px] font-medium tracking-tight text-foreground">
              {row.projectName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-mono",
                statusClass(row.status)
              )}
            >
              {inProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {statusLabel(row.status)}
            </span>
          </div>

          {row.productionUrl ? (
            <a
              href={row.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[12px] text-muted-foreground transition-colors hover:text-primary"
              title={row.productionUrl}
            >
              {displayHost(row.productionUrl)}
            </a>
          ) : (
            <p className="text-[12px] text-muted-foreground/55">尚无生产 URL</p>
          )}

          {row.lastDeployedAt ? (
            <p className="text-[11px] text-muted-foreground/50">
              {new Date(row.lastDeployedAt).toLocaleString()}
            </p>
          ) : null}

          {hasError ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setErrorOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-red-300/85 hover:text-red-200"
              >
                <CircleAlert className="h-3 w-3" />
                {errorOpen ? "收起原因" : "查看失败原因"}
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", errorOpen && "rotate-180")}
                />
              </button>
              {errorOpen ? (
                <div className="mt-2 max-w-2xl space-y-2 rounded-lg border border-red-400/15 bg-red-500/6 px-3 py-2.5">
                  <p className="text-[11px] leading-relaxed text-red-200/85">{row.lastError}</p>
                  <HelpLinksList links={helpLinks} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {row.productionUrl ? (
            <a
              href={row.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2.5 py-1.5 text-[12px] text-foreground/85 transition-colors hover:bg-white/5"
            >
              打开
            </a>
          ) : null}
          <button
            type="button"
            disabled={busyRow || inProgress}
            onClick={onRedeploy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors",
              busyRow || inProgress
                ? "cursor-not-allowed text-muted-foreground/50"
                : "bg-primary/14 text-primary hover:bg-primary/20"
            )}
          >
            {busyRow || inProgress ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Rocket className="h-3 w-3" />
            )}
            Deploy
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="更多操作"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem asChild>
                <Link href={`/studio/${encodeURIComponent(row.projectId)}`}>Studio</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={vercelHref} target="_blank" rel="noopener noreferrer">
                  Vercel 控制台
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
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
    const timer = window.setInterval(() => {
      void refreshDeployments().catch(() => {
        /* ignore transient poll errors */
      });
    }, 2500);
    return () => window.clearInterval(timer);
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

  const teamSlug = teams.find((team) => team.id === state.defaultTeamId)?.slug ?? null;

  const stats = useMemo(() => {
    const live = deployments.filter((d) => d.status === "ready").length;
    const failed = deployments.filter((d) => d.status === "error").length;
    const inFlight = deployments.filter(
      (d) => d.status != null && IN_PROGRESS.includes(d.status)
    ).length;
    return { live, failed, inFlight, total: deployments.length };
  }, [deployments]);

  const helpDefaultOpen = !state.connected || stats.failed > 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-8">
        <header className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {t("integrations")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("integrationsDescription")}
          </p>

          {state.connected && !loading ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" />
                <span className="text-foreground/90">Vercel</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate text-muted-foreground">{teamDisplayName(state)}</span>
                {stats.total > 0 ? (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground/75">
                      {stats.live} 上线
                      {stats.inFlight > 0 ? ` · ${stats.inFlight} 进行中` : ""}
                      {stats.failed > 0 ? ` · ${stats.failed} 失败` : ""}
                    </span>
                  </>
                ) : null}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unplug className="h-3 w-3" />
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
          ) : null}
        </header>

        {message ? (
          <p className="mb-5 rounded-lg border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-[13px] text-emerald-100/90">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-5 rounded-lg border border-red-400/20 bg-red-500/8 px-3 py-2 text-[13px] text-red-200/90">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : !state.configured ? (
          <p className="text-[13px] text-muted-foreground">
            当前环境未配置 Vercel Integration（需要{" "}
            <code className="font-mono text-[11px]">VERCEL_CLIENT_ID</code> 等）。
          </p>
        ) : !state.connected ? (
          <div className="space-y-10">
            <section className="rounded-xl border border-white/10 bg-white/2 px-5 py-6">
              <h2 className="text-[15px] font-medium text-foreground">连接你的 Vercel</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                授权后，Studio Deploy 会推到你自己的账号；与社区 Publish Preview 互不影响。
              </p>
              <a
                href={openOxVercelReconnectHref()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plug className="h-3.5 w-3.5" />
                连接 Vercel
              </a>
            </section>
            <SetupHelp
              connected={false}
              teamSlug={null}
              defaultOpen
              prominent
            />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-medium text-foreground">我的部署</h2>
                <Link
                  href="/dashboard?mine=1"
                  className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  我的项目
                </Link>
              </div>

              {deployments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    还没有部署。打开项目 Studio → Deploy。
                  </p>
                  <Link
                    href="/dashboard?mine=1"
                    className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    去我的项目
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
                  {deployments.map((row) => (
                    <DeployRowCard
                      key={row.projectId}
                      row={row}
                      teamSlug={teamSlug}
                      teamName={state.defaultTeamName}
                      busyRow={redeployingId === row.projectId}
                      onRedeploy={() => void redeploy(row.projectId, row.projectName)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <SetupHelp
              connected
              teamSlug={teamSlug}
              defaultOpen={helpDefaultOpen && stats.total === 0}
              prominent={false}
            />
          </div>
        )}
      </div>
    </main>
  );
}
