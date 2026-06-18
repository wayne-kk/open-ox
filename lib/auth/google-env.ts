/**
 * Whether Google OAuth via Supabase can complete end-to-end.
 * Credentials live in Supabase Dashboard → Authentication → Providers → Google.
 */
export function isGoogleOAuthConfigured(): boolean {
  if (process.env.GOOGLE_LOGIN_ENABLED?.trim().toLowerCase() === "false") {
    return false;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  return Boolean(url && key);
}
