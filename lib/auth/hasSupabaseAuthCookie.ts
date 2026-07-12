/**
 * Cheap presence check for Supabase SSR auth cookies.
 * Names look like `sb-<ref>-auth-token` (and optional `.0` / `.1` chunks).
 */
export function hasSupabaseAuthCookie(
  cookies: { name: string }[] | Iterable<{ name: string }>
): boolean {
  for (const cookie of cookies) {
    const name = cookie.name;
    if (name.includes("-auth-token")) return true;
  }
  return false;
}
