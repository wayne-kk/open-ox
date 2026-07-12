import { toast } from "sonner";

export type DeployNotifyStatus = "queued" | "building" | "uploading" | "ready" | "error";

/** Toast when a polled deploy transitions into a terminal state. */
export function notifyDeployTerminal(params: {
  projectLabel: string;
  prev: DeployNotifyStatus | null | undefined;
  next: DeployNotifyStatus | null | undefined;
  productionUrl?: string | null;
  lastError?: string | null;
}): void {
  const { projectLabel, prev, next, productionUrl, lastError } = params;
  if (!next || next === prev) return;
  if (next !== "ready" && next !== "error") return;
  // Only notify when leaving an in-progress (or unknown) state.
  const wasInFlight =
    prev == null || prev === "queued" || prev === "building" || prev === "uploading";
  if (!wasInFlight) return;

  if (next === "ready") {
    toast.success(`${projectLabel} 已部署上线`, {
      description: productionUrl ?? undefined,
      action: productionUrl
        ? {
            label: "打开",
            onClick: () => {
              window.open(productionUrl, "_blank", "noopener,noreferrer");
            },
          }
        : undefined,
    });
    return;
  }

  toast.error(`${projectLabel} 部署失败`, {
    description: lastError?.slice(0, 180) || "请稍后重试或查看详情",
  });
}
