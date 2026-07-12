/** Hostname from a URL or bare host string. */
export function hostFromUrlish(value: string): string {
  const raw = value.trim().replace(/^https?:\/\//i, "");
  const host = raw.split("/")[0]?.split("?")[0]?.trim() ?? "";
  return host.toLowerCase();
}

function httpsUrl(host: string): string {
  return `https://${host}`;
}

/**
 * Unique deployment hosts look like:
 *   `{project}-{uniqueHash}-{scope}.vercel.app`
 * Stable production hosts look like:
 *   `{project}-{scope}.vercel.app` or `{project}.vercel.app`
 *
 * When `projectName` is known, strip the unique hash segment after it.
 */
export function deriveStableVercelAppHost(
  deploymentUrlOrHost: string,
  projectName: string
): string | null {
  const host = hostFromUrlish(deploymentUrlOrHost);
  if (!host.endsWith(".vercel.app")) return null;

  const name = projectName.trim().toLowerCase();
  if (!name) return null;

  const prefix = `${name}-`;
  if (!host.startsWith(prefix)) {
    return host === `${name}.vercel.app` ? host : null;
  }

  const rest = host.slice(prefix.length);
  // `{hash}-{scope}.vercel.app` — deployment unique id is typically 7–14 alphanumeric
  const m = rest.match(/^([a-z0-9]{7,14})-(.+\.vercel\.app)$/i);
  if (m) {
    return `${name}-${m[2]}`;
  }

  // No hash segment — already stable (e.g. project-scope.vercel.app)
  return host;
}

/** True when host looks like a one-off deployment URL for this project. */
export function isDeploymentSpecificVercelHost(
  hostOrUrl: string,
  projectName?: string | null
): boolean {
  const host = hostFromUrlish(hostOrUrl);
  const name = projectName?.trim().toLowerCase();
  if (!name || !host.endsWith(".vercel.app")) return false;
  const derived = deriveStableVercelAppHost(host, name);
  return Boolean(derived && derived !== host);
}

/**
 * Prefer custom domains, then non-deployment `.vercel.app` aliases,
 * then shortest remaining host. Optionally coerce via projectName.
 */
export function pickStableProductionUrl(
  candidates: Array<string | null | undefined>,
  opts?: { projectName?: string | null }
): string | null {
  const hosts = candidates
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map(hostFromUrlish)
    .filter(Boolean);
  if (hosts.length === 0) return null;

  const projectName = opts?.projectName?.trim() || null;

  const coerced = hosts.map((h) => {
    if (projectName) {
      return deriveStableVercelAppHost(h, projectName) ?? h;
    }
    return h;
  });

  const custom = coerced.find((h) => !h.endsWith(".vercel.app"));
  if (custom) return httpsUrl(custom);

  if (projectName) {
    const stableVercel = coerced.filter((h) => !isDeploymentSpecificVercelHost(h, projectName));
    if (stableVercel.length > 0) {
      stableVercel.sort((a, b) => a.length - b.length || a.localeCompare(b));
      return httpsUrl(stableVercel[0]!);
    }
  }

  const vercelHosts = coerced.filter((h) => h.endsWith(".vercel.app"));
  const pool = vercelHosts.length > 0 ? vercelHosts : coerced;
  pool.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return httpsUrl(pool[0]!);
}

export type DeploymentUrlSource = {
  url?: string | null;
  alias?: string[] | null;
};

/** Resolve the URL we should store / show as the live production site. */
export function productionUrlFromDeployment(
  d: DeploymentUrlSource,
  opts?: { projectName?: string | null }
): string {
  const fromAliases = pickStableProductionUrl(d.alias ?? [], opts);
  if (fromAliases) return fromAliases;

  const fromUrl = pickStableProductionUrl([d.url], opts);
  if (fromUrl) return fromUrl;

  throw new Error("Deployment ready but missing url");
}

/** Fix a previously stored deployment-specific production URL when project name is known. */
export function coerceStoredProductionUrl(
  url: string | null | undefined,
  projectName: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  return pickStableProductionUrl([url], { projectName }) ?? url;
}
