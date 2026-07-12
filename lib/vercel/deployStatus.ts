export type DeployStatus = "queued" | "building" | "uploading" | "ready" | "error";

/** In-progress statuses shown as spinning in Studio / Integrations UI. */
export const DEPLOY_IN_PROGRESS: DeployStatus[] = ["queued", "building", "uploading"];

/** Queued should leave within seconds; longer means the worker died after enqueue. */
export const QUEUED_STALE_MS = 90_000;
/** Building/uploading can take a few minutes; hard-cap so the UI never spins forever. */
export const BUILD_STALE_MS = 15 * 60_000;

export type DeployStatusFields = {
  status: DeployStatus | null;
  lastError: string | null;
};

export type DeployRowStatusInput = {
  last_status: DeployStatus;
  last_error: string | null;
  updated_at: string;
};

/**
 * Idle / never-deployed public shape. Must NOT use status "queued" — that drives the spinner.
 */
export function idleDeployStatus(): DeployStatusFields {
  return { status: null, lastError: null };
}

/**
 * Map a DB row (or absence) to public status fields, including stale-worker recovery.
 * Never-deployed must be `status: null`, not `queued`.
 */
export function publicDeployStatusFromRow(
  row: DeployRowStatusInput | null,
  nowMs: number = Date.now()
): DeployStatusFields & { stale: boolean } {
  if (!row) {
    return { ...idleDeployStatus(), stale: false };
  }
  return applyStaleDeployTimeout(
    {
      status: row.last_status,
      lastError: row.last_error,
      updatedAt: row.updated_at,
    },
    nowMs
  );
}

/**
 * If a deploy row is still in-progress but older than the stale window, treat the worker as dead
 * so the UI stops spinning and the user can retry.
 */
export function applyStaleDeployTimeout(
  fields: DeployStatusFields & { updatedAt: string | null },
  nowMs: number = Date.now()
): DeployStatusFields & { stale: boolean } {
  const { status, lastError, updatedAt } = fields;
  if (!status || !DEPLOY_IN_PROGRESS.includes(status) || !updatedAt) {
    return { status, lastError, stale: false };
  }

  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) {
    return { status, lastError, stale: false };
  }

  const age = nowMs - updatedMs;
  const limit = status === "queued" ? QUEUED_STALE_MS : BUILD_STALE_MS;
  if (age < limit) {
    return { status, lastError, stale: false };
  }

  return {
    status: "error",
    lastError:
      lastError ??
      (status === "queued"
        ? "部署任务未启动（可能服务重启），请重新 Deploy"
        : "部署超时，请重新 Deploy"),
    stale: true,
  };
}
