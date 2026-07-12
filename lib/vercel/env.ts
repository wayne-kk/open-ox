export { isVercelDeployConfigured } from "@/lib/env";

/** Integration slug for install URL (`https://vercel.com/integrations/{slug}/new`). */
export function getVercelIntegrationSlug(): string | null {
  const slug = process.env.VERCEL_INTEGRATION_SLUG?.trim();
  return slug || null;
}

/**
 * Optional full install URL from Integrations Console → View / Install.
 * Use when `/integrations/{slug}/new` 404s (unpublished / slug mismatch).
 */
export function getVercelInstallUrlOverride(): string | null {
  const url = process.env.VERCEL_INSTALL_URL?.trim();
  return url || null;
}

export function getVercelOAuthRedirectUri(origin: string): string {
  const configured = process.env.VERCEL_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${origin.replace(/\/$/, "")}/api/integrations/vercel/callback`;
}
