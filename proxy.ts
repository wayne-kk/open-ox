import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Same-origin path only — prevents open redirects after login. */
function safeRedirectTarget(pathWithQuery: string): string {
  if (!pathWithQuery.startsWith("/") || pathWithQuery.startsWith("//")) {
    return "/projects";
  }
  return pathWithQuery;
}

const PROTECTED_PREFIXES = [
  "/studio",
  "/trajectories",
  "/llm-test",
  "/test-image",
  "/api/trajectories",
  "/api/llm-test",
  "/api/test-image",
];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  // Only protected routes run getUser() — avoids latency on static assets, OAuth, most /api/*.
  if (!needsAuth) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (!url || !key) {
    console.error("[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    const dest = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect", safeRedirectTarget(dest));
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
