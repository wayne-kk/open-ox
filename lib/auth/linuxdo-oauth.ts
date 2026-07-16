import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const LINUXDO_AUTHORIZE = "https://connect.linux.do/oauth2/authorize";
const LINUXDO_TOKEN = "https://connect.linux.do/oauth2/token";
const LINUXDO_USER_INFO = "https://connect.linux.do/api/user";

export interface LinuxDoUserInfo {
  id: number | string;
  username: string;
  name?: string;
  avatar_template?: string;
  active?: boolean;
  trust_level?: number;
  silenced?: boolean;
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Deterministic synthetic email for Supabase email+password auth (stable per Linux.do id). */
export function linuxdoSyntheticEmail(linuxdoId: string): string {
  const h = createHash("sha256").update(linuxdoId).digest("hex").slice(0, 40);
  return `linuxdo.${h}@linuxdo.open-ox.local`;
}

/** Server-only secret — same id always yields same password so repeat logins work. */
export function linuxdoDerivedPassword(linuxdoId: string): string {
  const secret = process.env.LINUXDO_OAUTH_HMAC_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("LINUXDO_OAUTH_HMAC_SECRET must be set (min 16 chars)");
  }
  return createHmac("sha256", secret).update(linuxdoId).digest("base64url").slice(0, 72);
}

/** Resolve Discourse-style avatar_template to a concrete avatar URL. */
export function resolveLinuxDoAvatarUrl(avatarTemplate: string | undefined, size = 120): string | undefined {
  if (!avatarTemplate?.trim()) return undefined;
  const withSize = avatarTemplate.replace(/\{size\}/g, String(size));
  if (withSize.startsWith("http://") || withSize.startsWith("https://")) return withSize;
  if (withSize.startsWith("//")) return `https:${withSize}`;
  if (withSize.startsWith("/")) return `https://linux.do${withSize}`;
  return `https://linux.do/${withSize}`;
}

export function buildLinuxDoAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const u = new URL(LINUXDO_AUTHORIZE);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  u.searchParams.set("scope", params.scope?.trim() || "user");
  return u.toString();
}

export async function exchangeLinuxDoCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch(LINUXDO_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? `Linux.do token error: HTTP ${res.status}`
    );
  }
  return { access_token: json.access_token };
}

export async function fetchLinuxDoUserInfo(accessToken: string): Promise<LinuxDoUserInfo> {
  const res = await fetch(LINUXDO_USER_INFO, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = (await res.json()) as LinuxDoUserInfo & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.error_description ?? json.error ?? `Linux.do user_info error: HTTP ${res.status}`
    );
  }
  if (json.id === undefined || json.id === null || !json.username) {
    throw new Error("Linux.do user_info missing id or username");
  }
  return json;
}
