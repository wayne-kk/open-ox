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
