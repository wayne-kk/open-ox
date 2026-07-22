import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/hasSupabaseAuthCookie";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { supabaseAuthErrorRedirectSearch } from "@/lib/auth/supabaseAuthErrorRedirect";
import {
  localeFromPathname,
  stripLocalePrefix,
  withLocalePrefix,
} from "@/lib/i18n/localePath";
import { routing } from "@/i18n/routing";
import {
  buildStaticPreviewUrl,
  hostnameFromHostHeader,
  isDedicatedPreviewOrigin,
  isPreviewHostRequest,
  rewriteDedicatedPreviewPathname,
} from "@/lib/previewOrigin";

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

/** Root `public/` files that must not get a locale rewrite (`/zh-CN/favicon.png` → 404). */
function isPublicStaticAssetPath(pathname: string): boolean {
  return /\.(?:avif|css|gif|ico|jpe?g|js|json|map|png|svg|txt|webmanifest|webp|woff2?|xml)$/i.test(
    pathname
  );
}

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
  const hostname = hostnameFromHostHeader(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.nextUrl.hostname
  );

  // Dedicated preview host (p.*): only serve rewritten /site-previews traffic.
  // Must run before next-intl or paths become /zh-CN/{projectId} → app 404.
  if (isPreviewHostRequest(hostname)) {
    if (path === "/" || path === "") {
      return new NextResponse("Open-OX preview host", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (path.startsWith("/site-previews") || path.startsWith("/open-ox")) {
      return NextResponse.next({ request });
    }
    const rewritten = rewriteDedicatedPreviewPathname(path);
    if (rewritten) {
      const url = request.nextUrl.clone();
      url.pathname = rewritten;
      return NextResponse.rewrite(url);
    }
    return new NextResponse("Not found", { status: 404 });
  }

  // Main app: send legacy /site-previews/{id} → dedicated preview origin /{id}.
  if (isDedicatedPreviewOrigin() && path.startsWith("/site-previews/")) {
    const rest = path.slice("/site-previews/".length);
    const projectIdSeg = decodeURIComponent(rest.split("/")[0] ?? "");
    if (projectIdSeg) {
      try {
        const dest = new URL(buildStaticPreviewUrl(projectIdSeg));
        const afterId = rest.includes("/")
          ? rest.slice(rest.indexOf("/") + 1)
          : "";
        if (afterId) {
          dest.pathname = `${dest.pathname.replace(/\/$/, "")}/${afterId}`;
        }
        dest.search = request.nextUrl.search;
        return NextResponse.redirect(dest, 308);
      } catch {
        /* fall through */
      }
    }
  }

  // Skip i18n for API, health, auth callback, site previews, public assets, SEO.
  // Matcher still runs for these (preview host needs `/{id}/_next/*.js`), but on the
  // main origin locale rewrite would turn `/favicon.png` into `/zh-CN/favicon.png`.
  if (
    path.startsWith("/api") ||
    path.startsWith("/health") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/site-previews") ||
    path.startsWith("/open-ox") ||
    isPublicStaticAssetPath(path) ||
    path === "/sitemap.xml" ||
    path === "/robots.txt"
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

  // Supabase redirects invalid/expired email links to the project Site URL.
  // Pull those root-level auth errors back into the login screen.
  if (stripped === "/") {
    const authErrorSearch = supabaseAuthErrorRedirectSearch(request.nextUrl.searchParams);
    if (authErrorSearch) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = withLocalePrefix("/auth", locale);
      redirectUrl.search = authErrorSearch;
      return NextResponse.redirect(redirectUrl);
    }
  }

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
    /*
     * Do NOT globally skip `*.js` / `*.css` / images / fonts.
     * On the dedicated preview host those live at `/{projectId}/_next/static/*`
     * and must hit this proxy to rewrite → `/site-previews/{projectId}/...`.
     * Root `/_next/static/*` (main app) stays excluded.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
    // Belt-and-suspenders for preview-host nested assets
    "/:projectId/_next/:path*",
    "/:projectId/images/:path*",
  ],
};
