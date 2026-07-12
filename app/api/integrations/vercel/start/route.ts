import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { isVercelDeployConfigured, getVercelOAuthRedirectUri } from "@/lib/vercel/env";
import { buildVercelInstallUrl, generateOAuthState } from "@/lib/vercel/oauth";

/**
 * Redirects to Vercel Integration install; sets state + next cookies.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  if (!isVercelDeployConfigured()) {
    return NextResponse.redirect(new URL("/settings/integrations?error=vercel_config", origin));
  }

  const session = await getSessionUser();
  if (!session) {
    const next = encodeURIComponent("/api/integrations/vercel/start");
    return NextResponse.redirect(new URL(`/auth?next=${next}`, origin));
  }

  const { searchParams } = new URL(request.url);
  const next = safeRedirectTarget(searchParams.get("next") ?? "/settings/integrations");

  const state = generateOAuthState();
  // Ensure redirect URI is resolvable (logs help if env mismatch).
  void getVercelOAuthRedirectUri(origin);

  let authorizeUrl: string;
  try {
    authorizeUrl = buildVercelInstallUrl({
      state,
      externalId: session.user.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=vercel_config&msg=${encodeURIComponent(msg.slice(0, 120))}`, origin)
    );
  }

  const res = NextResponse.redirect(authorizeUrl);
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("vercel_oauth_state", state, base);
  res.cookies.set("vercel_oauth_next", encodeURIComponent(next), base);
  res.cookies.set("vercel_oauth_uid", session.user.id, base);
  return res;
}
