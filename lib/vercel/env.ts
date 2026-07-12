/**
 * Whether BYO Vercel deploy can run end-to-end (OAuth + encrypted token store).
 */
export function isVercelDeployConfigured(): boolean {
  const clientId = process.env.VERCEL_CLIENT_ID?.trim();
  const clientSecret = process.env.VERCEL_CLIENT_SECRET?.trim();
  const encKey = process.env.VERCEL_TOKEN_ENCRYPTION_KEY?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(clientId && clientSecret && encKey && serviceRole);
}

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
