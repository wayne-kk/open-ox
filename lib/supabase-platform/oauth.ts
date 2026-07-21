import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSupabaseOAuthRedirectUri } from "./env";

const AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function buildSupabaseAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  organizationSlug?: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (params.organizationSlug?.trim()) {
    u.searchParams.set("organization_slug", params.organizationSlug.trim());
  }
  return u.toString();
}

export type SupabaseTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
};

async function readTokenError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = text
      ? (JSON.parse(text) as { error?: string; error_description?: string; message?: string })
      : null;
    return (
      json?.error_description ?? json?.message ?? json?.error ?? text.slice(0, 300) ?? `HTTP ${res.status}`
    );
  } catch {
    return text.slice(0, 300) || `HTTP ${res.status}`;
  }
}

export async function exchangeSupabaseCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<SupabaseTokenResponse> {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Supabase token exchange failed: ${await readTokenError(res)}`);
  }
  const json = (await res.json()) as SupabaseTokenResponse;
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Supabase token response missing access_token or refresh_token");
  }
  return json;
}

export async function refreshSupabaseToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<SupabaseTokenResponse> {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Supabase token refresh failed: ${await readTokenError(res)}`);
  }
  const json = (await res.json()) as SupabaseTokenResponse;
  if (!json.access_token) {
    throw new Error("Supabase refresh response missing access_token");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || params.refreshToken,
    expires_in: json.expires_in,
    token_type: json.token_type,
  };
}

export type SupabaseOrg = {
  id: string;
  name: string;
  slug: string;
};

/** List organizations visible to the OAuth token. */
export async function listSupabaseOrganizations(accessToken: string): Promise<SupabaseOrg[]> {
  const res = await fetch("https://api.supabase.com/v1/organizations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase /v1/organizations failed (${res.status}): ${await readTokenError(res)}`);
  }
  const json = (await res.json()) as Array<{
    id?: string;
    name?: string;
    slug?: string;
  }>;
  if (!Array.isArray(json)) {
    throw new Error("Supabase organizations response is not an array");
  }
  return json
    .filter((o): o is { id: string; name: string; slug: string } =>
      Boolean(o.id && o.name && o.slug)
    )
    .map((o) => ({ id: o.id, name: o.name, slug: o.slug }));
}

export function expiresAtFromExpiresIn(expiresIn?: number): string | null {
  if (expiresIn == null || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

/** Resolve redirect URI for tests / callers that already have origin. */
export function resolveAuthorizeRedirectUri(origin: string): string {
  return getSupabaseOAuthRedirectUri(origin);
}
