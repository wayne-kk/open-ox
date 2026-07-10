import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-env";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

/**
 * Redirects browser to Google via Supabase OAuth; session is established at /auth/callback.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/auth?error=google_config", origin));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!.trim();

  const { searchParams } = new URL(request.url);
  const next = safeRedirectTarget(searchParams.get("next") ?? "/dashboard");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "online",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    const msg = error?.message ?? "missing authorize url";
    return NextResponse.redirect(
      new URL(`/auth?error=google_start&msg=${encodeURIComponent(msg.slice(0, 180))}`, origin)
    );
  }

  const response = NextResponse.redirect(data.url);
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
