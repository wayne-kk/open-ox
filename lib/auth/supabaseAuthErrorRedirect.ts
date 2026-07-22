import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

const SUPABASE_AUTH_ERROR_CODES = new Set(["otp_expired"]);

export function supabaseAuthErrorRedirectSearch(params: URLSearchParams): string | null {
  const errorCode = params.get("error_code")?.trim() ?? "";
  const error = params.get("error")?.trim() ?? "";
  if (!errorCode && !error) return null;

  const authError = SUPABASE_AUTH_ERROR_CODES.has(errorCode) ? errorCode : "auth";
  const out = new URLSearchParams({ error: authError });
  const description = params.get("error_description")?.trim();
  if (description) out.set("msg", description.slice(0, 180));

  const redirect = params.get("redirect");
  if (redirect) out.set("redirect", safeRedirectTarget(redirect));
  return `?${out.toString()}`;
}
