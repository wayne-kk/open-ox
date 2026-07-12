import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import {
  exchangeVercelCode,
  fetchVercelTeam,
  fetchVercelUser,
  timingSafeEqualString,
} from "@/lib/vercel/oauth";
import { getVercelOAuthRedirectUri, isVercelDeployConfigured } from "@/lib/vercel/env";
import { upsertVercelConnection } from "@/lib/vercel/connections";

/** Merge query params onto a same-origin path that may already include `?`. */
function withQueryParams(pathWithQuery: string, extra: Record<string, string>): string {
  const safe = safeRedirectTarget(pathWithQuery);
  const q = safe.indexOf("?");
  const path = q >= 0 ? safe.slice(0, q) : safe;
  const params = new URLSearchParams(q >= 0 ? safe.slice(q + 1) : "");
  for (const [k, v] of Object.entries(extra)) {
    params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Vercel Integration redirects here with ?code=&state=&teamId=
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  if (!isVercelDeployConfigured()) {
    return NextResponse.redirect(new URL("/settings/integrations?error=vercel_config", origin));
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.redirect(new URL("/auth?next=/settings/integrations", origin));
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/settings/integrations?error=vercel_denied", origin));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const teamIdFromQuery = searchParams.get("teamId") ?? searchParams.get("team_id");
  const configurationId =
    searchParams.get("configurationId") ?? searchParams.get("configuration_id");
  const cookieState = request.cookies.get("vercel_oauth_state")?.value;
  const cookieUid = request.cookies.get("vercel_oauth_uid")?.value;
  const nextEncoded = request.cookies.get("vercel_oauth_next")?.value;

  let nextPath = "/settings/integrations";
  if (nextEncoded) {
    try {
      nextPath = decodeURIComponent(nextEncoded);
    } catch {
      nextPath = "/settings/integrations";
    }
  }
  nextPath = safeRedirectTarget(nextPath);

  if (!code || !state || !cookieState || !timingSafeEqualString(state, cookieState)) {
    return NextResponse.redirect(new URL("/settings/integrations?error=vercel_state", origin));
  }

  if (cookieUid && cookieUid !== session.user.id) {
    return NextResponse.redirect(new URL("/settings/integrations?error=vercel_user", origin));
  }

  const clientId = process.env.VERCEL_CLIENT_ID!.trim();
  const clientSecret = process.env.VERCEL_CLIENT_SECRET!.trim();
  const redirectUri = getVercelOAuthRedirectUri(origin);

  let token: Awaited<ReturnType<typeof exchangeVercelCode>>;
  try {
    token = await exchangeVercelCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=vercel_token&msg=${encodeURIComponent(msg.slice(0, 180))}`,
        origin
      )
    );
  }

  let vercelUserId: string | null = token.user_id ?? null;
  try {
    const user = await fetchVercelUser(token.access_token);
    vercelUserId = user.id;
  } catch {
    // token may still work for team-scoped deploy
  }

  // Token exchange `team_id` is the Integration install scope (authoritative).
  // Query teamId can disagree after UI drift; prefer token when present.
  const teamId = token.team_id ?? teamIdFromQuery ?? null;
  let teamName: string | null = null;
  if (teamId) {
    try {
      teamName = (await fetchVercelTeam(token.access_token, teamId)).name;
    } catch {
      teamName = null;
    }
  }

  try {
    await upsertVercelConnection({
      userId: session.user.id,
      accessToken: token.access_token,
      vercelUserId,
      defaultTeamId: teamId,
      defaultTeamName: teamName,
      configurationId: configurationId ?? token.installation_id ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=vercel_store&msg=${encodeURIComponent(msg.slice(0, 180))}`,
        origin
      )
    );
  }

  const dest = withQueryParams(nextPath, { vercel: "connected" });
  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.set("vercel_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("vercel_oauth_next", "", { path: "/", maxAge: 0 });
  res.cookies.set("vercel_oauth_uid", "", { path: "/", maxAge: 0 });
  return res;
}
