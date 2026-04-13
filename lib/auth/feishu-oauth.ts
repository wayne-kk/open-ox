import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const FEISHU_AUTHORIZE = "https://accounts.feishu.cn/open-apis/authen/v1/authorize";
const FEISHU_TOKEN = "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
const FEISHU_USER_INFO = "https://open.feishu.cn/open-apis/authen/v1/user_info";

export interface FeishuUserInfo {
  name: string;
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  email?: string;
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

/** Deterministic synthetic email for Supabase email+password auth (stable per Feishu open_id). */
export function feishuSyntheticEmail(openId: string): string {
  const h = createHash("sha256").update(openId).digest("hex").slice(0, 40);
  return `feishu.${h}@feishu.open-ox.local`;
}

/** Server-only secret — same open_id always yields same password so repeat logins work. */
export function feishuDerivedPassword(openId: string): string {
  const secret = process.env.FEISHU_OAUTH_HMAC_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("FEISHU_OAUTH_HMAC_SECRET must be set (min 16 chars)");
  }
  return createHmac("sha256", secret).update(openId).digest("base64url").slice(0, 72);
}

export function buildFeishuAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const u = new URL(FEISHU_AUTHORIZE);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  if (params.scope?.trim()) {
    u.searchParams.set("scope", params.scope.trim());
  }
  return u.toString();
}

export async function exchangeFeishuCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string }> {
  const res = await fetch(FEISHU_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });
  const json = (await res.json()) as {
    code?: number;
    access_token?: string;
    msg?: string;
    error?: string;
    error_description?: string;
  };
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(json.msg ?? json.error_description ?? json.error ?? `Feishu token error: ${json.code}`);
  }
  if (!json.access_token) {
    throw new Error(json.msg ?? json.error_description ?? "Feishu token response missing access_token");
  }
  return { access_token: json.access_token };
}

export async function fetchFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const res = await fetch(FEISHU_USER_INFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: FeishuUserInfo;
  };
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(json.msg ?? `Feishu user_info error: ${json.code}`);
  }
  const d = json.data;
  if (!d?.open_id) {
    throw new Error("Feishu user_info missing open_id");
  }
  return d;
}
