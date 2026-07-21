export { isSupabasePlatformConfigured } from "@/lib/env";

export function getSupabaseOAuthRedirectUri(origin: string): string {
  const configured = process.env.SUPABASE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${origin.replace(/\/$/, "")}/api/integrations/supabase/callback`;
}

export function getSupabaseOAuthClientId(): string | null {
  return process.env.SUPABASE_OAUTH_CLIENT_ID?.trim() || null;
}

export function getSupabaseOAuthClientSecret(): string | null {
  return process.env.SUPABASE_OAUTH_CLIENT_SECRET?.trim() || null;
}

export function openOxSupabaseConnectHref(next = "/settings/integrations"): string {
  const q = new URLSearchParams({ next });
  return `/api/integrations/supabase/start?${q.toString()}`;
}
