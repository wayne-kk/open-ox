import { NextRequest, NextResponse } from "next/server";
import { isLinuxDoOAuthConfigured } from "@/lib/auth/linuxdo-env";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { buildLinuxDoAuthorizeUrl, generateOAuthState } from "@/lib/auth/linuxdo-oauth";

/**
 * Redirects browser to Linux.do Connect authorize page; sets short-lived cookies for state + post-login path.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  if (!isLinuxDoOAuthConfigured()) {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_config", origin));
  }

  const clientId = process.env.LINUXDO_CLIENT_ID!.trim();

  const { searchParams } = new URL(request.url);
  const next = safeRedirectTarget(searchParams.get("next") ?? "/dashboard");

  const redirectUri = `${origin}/api/auth/linuxdo/callback`;
  const state = generateOAuthState();

  const authorizeUrl = buildLinuxDoAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(authorizeUrl);
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("linuxdo_oauth_state", state, base);
  res.cookies.set("linuxdo_oauth_next", encodeURIComponent(next), base);
  return res;
}
