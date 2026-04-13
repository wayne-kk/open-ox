import { NextRequest, NextResponse } from "next/server";
import { buildFeishuAuthorizeUrl, generateOAuthState } from "@/lib/auth/feishu-oauth";

/**
 * Redirects browser to Feishu authorize page; sets short-lived cookies for state + post-login path.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.FEISHU_APP_ID;
  if (!clientId) {
    return NextResponse.json({ error: "FEISHU_APP_ID not configured" }, { status: 500 });
  }

  const { searchParams, origin } = new URL(request.url);
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
