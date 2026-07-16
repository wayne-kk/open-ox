import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  acquisitionTouchToProperties,
  OX_ACQ_COOKIE,
  parseAcquisitionFromUrl,
  parseOxAcqCookieValue,
} from "@/lib/analytics/acquisition";
import { bindUserAcquisition } from "@/lib/analytics/bindUserAcquisition";
import { AnalyticsEventName } from "@/lib/analytics/catalog";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

function resolveAcquisitionTouch(request: NextRequest) {
  const fromCookie = parseOxAcqCookieValue(request.cookies.get(OX_ACQ_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return parseAcquisitionFromUrl({
      href: referer,
      referrer: referer,
    });
  } catch {
    return null;
  }
}

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
        const touch = resolveAcquisitionTouch(request);
        try {
          await bindUserAcquisition({ userId: user.id, touch });
        } catch (err) {
          console.warn(
            "[analytics] acquisition bind failed:",
            err instanceof Error ? err.message : err
          );
        }

        const { trackServerAnalyticsEventFireAndForget } = await import(
          "@/lib/analytics/serverEvents"
        );
        const provider =
          (user.app_metadata as Record<string, unknown> | undefined)?.provider ??
          user.identities?.[0]?.provider ??
          "oauth";
        trackServerAnalyticsEventFireAndForget({
          userId: user.id,
          eventName: AnalyticsEventName.authSuccess,
          properties: {
            provider: String(provider),
            ...(touch ? acquisitionTouchToProperties(touch) : {}),
          },
        });
      }
      return supabaseResponse;
    }
  }

  return NextResponse.redirect(new URL("/auth?error=auth", origin));
}
