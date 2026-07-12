"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plug, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionState = {
  configured: boolean;
  connected: boolean;
  defaultTeamId: string | null;
  defaultTeamName: string | null;
  connectedAt: string | null;
};

type Team = { id: string; name: string; slug?: string };

const ERROR_COPY: Record<string, string> = {
  vercel_config: "Vercel Integration 未配置（缺少环境变量）",
  vercel_denied: "已取消授权",
  vercel_state: "OAuth state 校验失败，请重试",
  vercel_user: "登录用户与发起连接的用户不一致",
  vercel_token: "换取 access token 失败",
  vercel_store: "保存连接失败",
};

export function IntegrationsSettingsClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ConnectionState>({
    configured: false,
    connected: false,
    defaultTeamId: null,
    defaultTeamName: null,
    connectedAt: null,
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
        setError(body.error ?? "加载失败");
        return;
      }
      setState({
        configured: body.configured !== false,
        connected: body.connected === true,
        defaultTeamId: body.defaultTeamId ?? null,
        defaultTeamName: body.defaultTeamName ?? null,
        connectedAt: body.connectedAt ?? null,
      });

      if (body.connected) {
        const tRes = await fetch("/api/integrations/vercel/teams", { credentials: "include" });
        if (tRes.ok) {
          const tBody = (await tRes.json()) as { teams?: Team[] };
          setTeams(tBody.teams ?? []);
        }
      } else {
        setTeams([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

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
    }
  }, [searchParams]);

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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
      <header className="mb-10">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground">
          Integrations
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          连接你自己的 Vercel 账号，在 Studio 里一键 Deploy 静态站点。与社区 Publish Preview
          无关。
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

      <section className="space-y-5 rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-[15px] font-medium text-foreground">Vercel</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              OAuth 授权后，Deploy 会在你选中的 Team 下创建项目并推送静态产物。
            </p>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="mt-5 space-y-4">
          {!state.configured ? (
            <p className="text-[13px] text-muted-foreground">
              当前环境未配置 Vercel Integration（需要{" "}
              <code className="font-mono text-[11px]">VERCEL_CLIENT_ID</code> 等）。
            </p>
          ) : !state.connected ? (
            <a
              href="/api/integrations/vercel/start?next=/settings/integrations"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-4 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/22"
              )}
            >
              <Plug className="h-4 w-4" />
              Connect Vercel
            </a>
          ) : (
            <>
              <dl className="grid gap-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">状态</dt>
                  <dd className="text-emerald-200/90">已连接</dd>
                </div>
                {state.defaultTeamName || state.defaultTeamId ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">默认 Team</dt>
                    <dd className="text-foreground">
                      {state.defaultTeamName ?? state.defaultTeamId}
                    </dd>
                  </div>
                ) : (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">默认 Team</dt>
                    <dd className="text-muted-foreground">个人账号（无 Team）</dd>
                  </div>
                )}
                {state.connectedAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">连接时间</dt>
                    <dd className="font-mono text-[11px] text-foreground/80">
                      {new Date(state.connectedAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {teams.length > 0 ? (
                <label className="block space-y-1.5">
                  <span className="text-[12px] text-muted-foreground">切换默认 Team</span>
                  <select
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/40"
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

              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5 text-[13px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Disconnect
              </button>
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                断开只会清除 Open-OX 侧的授权与项目绑定，不会删除你在 Vercel 上的项目或部署。
              </p>
            </>
          )}
        </div>
      </section>

      <p className="mt-8 text-[12px] text-muted-foreground">
        也可以在 Studio 点 <span className="font-mono text-[11px]">Deploy</span>
        →「连接并 Deploy」，授权后会自动开始第一次部署。
      </p>
    </main>
  );
}
