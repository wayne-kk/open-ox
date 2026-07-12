import {
  openOxVercelReconnectHref,
  vercelIntegrationPermissionsDocsUrl,
  vercelIntegrationsDashboardUrl,
  vercelTeamIntegrationsUrl,
} from "./dashboardUrl";
import { isVercelCreateProjectPermissionError } from "./createProjectPermission";

export type DeployHelpKind = "create_permission" | "not_connected" | "generic";

export type DeployHelpLink = {
  id: string;
  label: string;
  href: string;
  /** Same-origin reconnect vs external Vercel. */
  external: boolean;
};

export function classifyDeployHelp(error: string | null | undefined): DeployHelpKind {
  const raw = (error ?? "").trim();
  if (!raw) return "generic";
  const lower = raw.toLowerCase();
  if (
    isVercelCreateProjectPermissionError(raw) ||
    raw.includes("没有权限在当前 Vercel 范围创建项目") ||
    raw.includes("Project 写入")
  ) {
    return "create_permission";
  }
  if (
    lower.includes("not connected") ||
    lower.includes("vercel_not_connected") ||
    raw.includes("未连接") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid token") ||
    lower.includes("token expired")
  ) {
    return "not_connected";
  }
  return "generic";
}

/**
 * Actionable links for a deploy failure (or the sidebar troubleshooting panel).
 * Prefer Integrations Manage + reconnect for create-permission 403s.
 */
export function deployHelpLinks(params: {
  error?: string | null;
  teamSlug?: string | null;
  /** When true, always include the full sidebar set (not error-narrowed). */
  panel?: boolean;
}): DeployHelpLink[] {
  const kind = classifyDeployHelp(params.error);
  const teamIntegrations = vercelTeamIntegrationsUrl(params.teamSlug);
  const links: DeployHelpLink[] = [];

  const push = (link: DeployHelpLink) => {
    if (links.some((l) => l.id === link.id)) return;
    links.push(link);
  };

  if (params.panel || kind === "create_permission" || kind === "generic") {
    push({
      id: "integrations",
      label: "在 Vercel 管理 Integrations",
      href: vercelIntegrationsDashboardUrl(),
      external: true,
    });
    if (teamIntegrations) {
      push({
        id: "team_integrations",
        label: "打开该 Team 的 Integrations",
        href: teamIntegrations,
        external: true,
      });
    }
  }

  if (params.panel || kind === "create_permission" || kind === "generic") {
    push({
      id: "docs",
      label: "查看 Integration 权限说明",
      href: vercelIntegrationPermissionsDocsUrl(),
      external: true,
    });
  }

  if (params.panel || kind === "create_permission" || kind === "not_connected") {
    push({
      id: "reconnect",
      label: kind === "not_connected" ? "重新连接 Vercel" : "断开后重新授权",
      href: openOxVercelReconnectHref(),
      external: false,
    });
  }

  if (kind === "not_connected" && !params.panel) {
    // Narrow: only reconnect for auth failures on a row.
    return links.filter((l) => l.id === "reconnect");
  }

  return links;
}
