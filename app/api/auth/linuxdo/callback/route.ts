import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeLinuxDoCode,
  fetchLinuxDoUserInfo,
  linuxdoDerivedPassword,
  linuxdoSyntheticEmail,
  resolveLinuxDoAvatarUrl,
  timingSafeEqualString,
} from "@/lib/auth/linuxdo-oauth";
import { provisionOAuthUserAndSignIn } from "@/lib/auth/feishu-supabase";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Linux.do Connect redirects here with ?code=&state= — exchange code server-side, then Supabase email session.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/auth?error=config", origin));
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_denied", origin));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("linuxdo_oauth_state")?.value;
  const nextEncoded = request.cookies.get("linuxdo_oauth_next")?.value;
  let nextPath = "/dashboard";
  if (nextEncoded) {
    try {
      nextPath = decodeURIComponent(nextEncoded);
    } catch {
      nextPath = "/dashboard";
    }
  }
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    nextPath = "/dashboard";
  }
  const pathOnly = nextPath.split("?")[0] ?? nextPath;
  if (pathOnly === "/") {
    nextPath = "/dashboard";
  }

  if (!code || !state || !cookieState || !timingSafeEqualString(state, cookieState)) {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_state", origin));
  }

  const clientId = process.env.LINUXDO_CLIENT_ID;
  const clientSecret = process.env.LINUXDO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_config", origin));
  }

  const redirectUri = `${origin}/api/auth/linuxdo/callback`;

  let accessToken: string;
  try {
    ({ access_token: accessToken } = await exchangeLinuxDoCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/auth?error=linuxdo_token&msg=${encodeURIComponent(msg.slice(0, 180))}`, origin)
    );
  }

  let linuxdoUser: Awaited<ReturnType<typeof fetchLinuxDoUserInfo>>;
  try {
    linuxdoUser = await fetchLinuxDoUserInfo(accessToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/auth?error=linuxdo_profile&msg=${encodeURIComponent(msg.slice(0, 180))}`, origin)
    );
  }

  const linuxdoId = String(linuxdoUser.id);
  const email = linuxdoSyntheticEmail(linuxdoId);
  let password: string;
  try {
    password = linuxdoDerivedPassword(linuxdoId);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_secret", origin));
  }

  const displayName = (linuxdoUser.name?.trim() || linuxdoUser.username).trim();
  const avatarUrl = resolveLinuxDoAvatarUrl(linuxdoUser.avatar_template);

  const userMetadata: Record<string, unknown> = {
    provider: "linuxdo",
    linuxdo_id: linuxdoId,
    linuxdo_username: linuxdoUser.username,
    full_name: displayName,
    preferred_username: linuxdoUser.username,
  };
  if (avatarUrl) userMetadata.avatar_url = avatarUrl;
  if (typeof linuxdoUser.trust_level === "number") {
    userMetadata.linuxdo_trust_level = linuxdoUser.trust_level;
  }

  const redirectTo = new URL(nextPath, origin);
  const response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.redirect(new URL("/auth?error=linuxdo_config", origin));
  }

  const result = await provisionOAuthUserAndSignIn(admin, supabase, {
    email,
    password,
    userMetadata,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/auth?error=linuxdo_auth&msg=${encodeURIComponent(result.message.slice(0, 180))}`, origin)
    );
  }

  response.cookies.delete("linuxdo_oauth_state");
  response.cookies.delete("linuxdo_oauth_next");
  return response;
}
