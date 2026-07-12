/** User-facing guidance when Vercel refuses project creation. */
export const VERCEL_CREATE_PROJECT_PERMISSION_HINT =
  "没有权限在当前 Vercel 范围创建项目。请断开后重新连接，并在授权页选择你有创建权限的 Team；授权时需允许创建项目（Project 写入）。若曾手动切换「默认 Team」，请改回连接时的 Team 或重新授权。";

export function isVercelCreateProjectPermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("permission to create the project") ||
    (m.includes("403") && m.includes("create the project"))
  );
}

/**
 * TeamId attempts for create-project.
 * Prefers the Integration installation team (token truth), then any stored default,
 * then personal (null). Deduped.
 */
export function teamIdCandidatesForCreateWithFallback(
  storedTeamId: string | null | undefined,
  installationTeamId: string | null | undefined
): Array<string | null> {
  const seen = new Set<string>();
  const out: Array<string | null> = [];
  const push = (id: string | null) => {
    const key = id ?? "";
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id);
  };

  const stored = storedTeamId?.trim() ? storedTeamId.trim() : null;
  const install = installationTeamId?.trim() ? installationTeamId.trim() : null;

  if (install) push(install);
  if (stored) push(stored);
  push(null);
  return out;
}

export function formatVercelCreateProjectError(raw: string): string {
  if (isVercelCreateProjectPermissionError(raw)) {
    return VERCEL_CREATE_PROJECT_PERMISSION_HINT;
  }
  return raw;
}
