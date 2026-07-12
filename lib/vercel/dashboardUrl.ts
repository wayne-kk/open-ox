/** Best-effort link to the project on vercel.com (not the production site). */
export function vercelProjectDashboardUrl(params: {
  vercelProjectName: string | null | undefined;
  teamSlug?: string | null;
  teamName?: string | null;
}): string {
  const name = params.vercelProjectName?.trim();
  const team = (params.teamSlug ?? params.teamName)?.trim();
  if (team && name) {
    return `https://vercel.com/${encodeURIComponent(team)}/${encodeURIComponent(name)}`;
  }
  if (name) {
    return `https://vercel.com/${encodeURIComponent(name)}`;
  }
  return "https://vercel.com/dashboard";
}

/** Account-level list of installed Integrations (Manage Access / Project write). */
export function vercelIntegrationsDashboardUrl(): string {
  return "https://vercel.com/dashboard/integrations";
}

/** Team-scoped Integrations list when we know the team slug. */
export function vercelTeamIntegrationsUrl(teamSlug: string | null | undefined): string | null {
  const slug = teamSlug?.trim();
  if (!slug) return null;
  return `https://vercel.com/${encodeURIComponent(slug)}/~/integrations`;
}

/** Official docs: integration permissions / project access. */
export function vercelIntegrationPermissionsDocsUrl(): string {
  return "https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference";
}

/** Open-OX OAuth reconnect entry (same-origin path). */
export function openOxVercelReconnectHref(): string {
  return "/api/integrations/vercel/start?next=/settings/integrations";
}
