import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { finalizeAuthenticatedLogin } from "@/lib/auth/post-login";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !key) {
    return NextResponse.redirect(new URL("/auth?error=config", origin));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectTarget(searchParams.get("next") ?? "/dashboard");

  if (code) {
    const supabaseResponse = NextResponse.redirect(new URL(next, origin));
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const provider =
          (user.app_metadata as Record<string, unknown> | undefined)?.provider ??
          user.identities?.[0]?.provider ??
          "oauth";
        await finalizeAuthenticatedLogin({
          request,
          supabase,
          user,
          provider: String(provider),
        });
      }
      return supabaseResponse;
    }
  }

  return NextResponse.redirect(new URL("/auth?error=auth", origin));
}
