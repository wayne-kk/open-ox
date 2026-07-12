import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/hasSupabaseAuthCookie";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import {
  localeFromPathname,
  stripLocalePrefix,
  withLocalePrefix,
} from "@/lib/i18n/localePath";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const PROTECTED_PREFIXES = [
  "/studio",
  "/settings",
  "/llm-test",
  "/test-image",
  "/api/llm-test",
  "/api/test-image",
];

export { stripLocalePrefix };

function createSupabaseFromRequest(
  request: NextRequest,
  i18nResponse: NextResponse
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (!url || !key) {
    console.error(
      "[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
    );
    return null;
  }

  let supabaseResponse = i18nResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
          headers: i18nResponse.headers,
        });
        i18nResponse.headers.forEach((v, k) => {
          if (k.toLowerCase() === "set-cookie") return;
          supabaseResponse.headers.set(k, v);
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  return { supabase, getResponse: () => supabaseResponse };
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip i18n for API, health, auth callback, and site preview assets.
  if (
    path.startsWith("/api") ||
    path.startsWith("/health") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/site-previews")
  ) {
    return NextResponse.next({ request });
  }

  const i18nResponse = handleI18nRouting(request);

  // If next-intl is redirecting (locale cookie / prefix normalize), honor that first.
  if (i18nResponse.headers.get("location")) {
    return i18nResponse;
  }

  const pathname = request.nextUrl.pathname;
  const stripped = stripLocalePrefix(pathname);
  const locale = localeFromPathname(pathname);

  // Logged-in users hitting marketing `/` → dashboard (cookie presence first).
  if (stripped === "/" && hasSupabaseAuthCookie(request.cookies.getAll())) {
    const client = createSupabaseFromRequest(request, i18nResponse);
    if (client) {
      const {
        data: { user },
      } = await client.supabase.auth.getUser();
      if (user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = withLocalePrefix("/dashboard", locale);
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
      return client.getResponse();
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => stripped === p || stripped.startsWith(`${p}/`)
  );

  if (!needsAuth) {
    return i18nResponse;
  }

  const client = createSupabaseFromRequest(request, i18nResponse);
  if (!client) {
    return i18nResponse;
  }

  const {
    data: { user },
  } = await client.supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = withLocalePrefix("/auth", locale);
    const dest = `${stripped}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect", safeRedirectTarget(dest));
    return NextResponse.redirect(redirectUrl);
  }

  return client.getResponse();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|ico|woff2?)$).*)",
  ],
};
