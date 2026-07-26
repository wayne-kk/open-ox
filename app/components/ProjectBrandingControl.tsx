"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, BadgeX, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BrandingState = {
  removed: boolean;
  balance: number;
  priceCredits: number;
  hasProductionDeployment: boolean;
};

export function ProjectBrandingControl({ projectId }: { projectId: string }) {
  const [state, setState] = useState<BrandingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/branding`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("品牌状态加载失败");
      setState((await response.json()) as BrandingState);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "品牌状态加载失败",
      );
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function purchase() {
    if (!state || state.removed || busy) return;
    if (state.balance < state.priceCredits) {
      window.location.href = "/pricing";
      return;
    }
    const confirmed = window.confirm(
      state.hasProductionDeployment
        ? `使用 ${state.priceCredits} Credits 永久移除 Made with Open OX，并立即重新 Deploy 当前 Vercel 网站？`
        : `使用 ${state.priceCredits} Credits 永久移除此项目的 Made with Open OX 标记？`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/branding`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        balance?: number;
        redeployScheduled?: boolean;
        redeployError?: string | null;
      };
      if (!response.ok) {
        if (body.code === "INSUFFICIENT_CREDITS") {
          window.location.href = "/pricing";
          return;
        }
        throw new Error(body.error || "购买失败");
      }
      setState({
        ...state,
        removed: true,
        balance: body.balance ?? state.balance - state.priceCredits,
      });
      toast.success("已永久移除 Open OX 品牌", {
        description: body.redeployScheduled
          ? "社区预览正在刷新，Vercel 也已开始重新 Deploy。"
          : body.redeployError
            ? "权益已生效，但 Vercel 自动重新 Deploy 失败；请在 Deploy 菜单重试。"
            : "社区预览会自动刷新；下次 Deploy 也会保持无品牌状态。",
      });
    } catch (purchaseError) {
      const message =
        purchaseError instanceof Error ? purchaseError.message : "购买失败";
      setError(message);
      toast.error("品牌移除购买失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {error || "加载品牌状态…"}
      </div>
    );
  }

  return (
    <div className="border-t border-border/70 px-2 pt-2">
      <div className="flex items-start gap-2">
        {state.removed ? (
          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        ) : (
          <BadgeX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-foreground">
            {state.removed
              ? "Open OX 品牌已永久移除"
              : "公开页面显示 Made with Open OX"}
          </p>
          {!state.removed ? (
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/70">
              单项目买断 {state.priceCredits} Credits（$20） · 余额{" "}
              {state.balance}
            </p>
          ) : null}
          {error ? (
            <p className="mt-1 text-[10px] text-red-400/90">{error}</p>
          ) : null}
        </div>
      </div>
      {!state.removed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void purchase()}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <BadgeX className="h-3 w-3" />
          )}
          {state.balance >= state.priceCredits
            ? state.hasProductionDeployment
              ? "永久移除并重新 Deploy"
              : "永久移除品牌"
            : "充值后移除品牌"}
        </button>
      ) : null}
    </div>
  );
}
