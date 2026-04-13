import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeFeishuCode,
  fetchFeishuUserInfo,
  feishuDerivedPassword,
  feishuSyntheticEmail,
  timingSafeEqualString,
} from "@/lib/auth/feishu-oauth";
import { provisionFeishuUserAndSignIn } from "@/lib/auth/feishu-supabase";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Feishu redirects here with ?code=&state= — exchange code server-side, then Supabase email session.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/auth?error=config", origin));
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("error") === "access_denied") {
    return NextResponse.redirect(new URL("/auth?error=feishu_denied", origin));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("feishu_oauth_state")?.value;
  const nextEncoded = request.cookies.get("feishu_oauth_next")?.value;
  let nextPath = "/projects";
  if (nextEncoded) {
    try {
      nextPath = decodeURIComponent(nextEncoded);
    } catch {
      nextPath = "/projects";
    }
  }
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    nextPath = "/projects";
  }

  if (!code || !state || !cookieState || !timingSafeEqualString(state, cookieState)) {
    return NextResponse.redirect(new URL("/auth?error=feishu_state", origin));
  }

  const clientId = process.env.FEISHU_APP_ID;
  const clientSecret = process.env.FEISHU_APP_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/auth?error=feishu_config", origin));
  }

  const redirectUri = `${origin}/api/auth/feishu/callback`;

  let accessToken: string;
  try {
    ({ access_token: accessToken } = await exchangeFeishuCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/auth?error=feishu_token&msg=${encodeURIComponent(msg.slice(0, 180))}`, origin)
    );
  }

  let feishuUser: Awaited<ReturnType<typeof fetchFeishuUserInfo>>;
  try {
    feishuUser = await fetchFeishuUserInfo(accessToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/auth?error=feishu_profile&msg=${encodeURIComponent(msg.slice(0, 180))}`, origin)
    );
  }

  const email = feishuSyntheticEmail(feishuUser.open_id);
  let password: string;
  try {
    password = feishuDerivedPassword(feishuUser.open_id);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=feishu_secret", origin));
  }

  const userMetadata: Record<string, unknown> = {
    feishu_open_id: feishuUser.open_id,
    full_name: feishuUser.name,
  };
  if (feishuUser.avatar_url) userMetadata.avatar_url = feishuUser.avatar_url;
  if (feishuUser.email) userMetadata.email = feishuUser.email;

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

  const admin = createSupabaseServiceRoleClient();
  const result = await provisionFeishuUserAndSignIn(admin, supabase, {
    email,
    password,
    userMetadata,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/auth?error=feishu_auth&msg=${encodeURIComponent(result.message.slice(0, 180))}`, origin)
    );
  }

  response.cookies.delete("feishu_oauth_state");
  response.cookies.delete("feishu_oauth_next");
  return response;
}
