import { NextRequest, NextResponse } from "next/server";
import { isFeishuOAuthConfigured } from "@/lib/auth/feishu-env";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { buildFeishuAuthorizeUrl, generateOAuthState } from "@/lib/auth/feishu-oauth";

/**
 * Redirects browser to Feishu authorize page; sets short-lived cookies for state + post-login path.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  if (!isFeishuOAuthConfigured()) {
    return NextResponse.redirect(new URL("/auth?error=feishu_config", origin));
  }

  const clientId = process.env.FEISHU_APP_ID!.trim();

  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/projects";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return NextResponse.json({ error: "Invalid next" }, { status: 400 });
  }

  const redirectUri = `${origin}/api/auth/feishu/callback`;
  const state = generateOAuthState();
  const scope = process.env.FEISHU_OAUTH_SCOPE ?? "";

  const authorizeUrl = buildFeishuAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    scope: scope.trim() || undefined,
  });

  const res = NextResponse.redirect(authorizeUrl);
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("feishu_oauth_state", state, base);
  res.cookies.set("feishu_oauth_next", encodeURIComponent(next), base);
  return res;
}
