import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getVercelInstallUrlOverride, getVercelIntegrationSlug } from "./env";

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Build the Vercel Integration install URL.
 * Users pick a team on Vercel's UI; callback returns code + teamId.
 *
 * Prefer `VERCEL_INSTALL_URL` (paste from Integrations Console) when the public
 * `/integrations/{slug}/new` route 404s for unpublished integrations.
 */
export function buildVercelInstallUrl(params: {
  state: string;
  externalId?: string;
}): string {
  const override = getVercelInstallUrlOverride();
  if (override) {
    const u = new URL(override);
    u.searchParams.set("state", params.state);
    if (params.externalId && !u.searchParams.has("external-id")) {
      u.searchParams.set("external-id", params.externalId);
    }
    return u.toString();
  }

  const slug = getVercelIntegrationSlug();
  if (slug) {
    const u = new URL(`https://vercel.com/integrations/${encodeURIComponent(slug)}/new`);
    u.searchParams.set("state", params.state);
    if (params.externalId) {
      u.searchParams.set("external-id", params.externalId);
    }
    return u.toString();
  }

  // Fallback: client_id install entry (some console integrations).
  const clientId = process.env.VERCEL_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("VERCEL_CLIENT_ID (and preferably VERCEL_INTEGRATION_SLUG) required");
  }
  const u = new URL("https://vercel.com/oauth/integrations");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("configurationId", "new");
  u.searchParams.set("state", params.state);
  return u.toString();
}

export type VercelTokenResponse = {
  access_token: string;
  token_type?: string;
  installation_id?: string;
  user_id?: string;
  team_id?: string | null;
};

export async function exchangeVercelCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<VercelTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const res = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as VercelTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? `Vercel token exchange failed (${res.status})`
    );
  }
  return json;
}

export async function fetchVercelUser(accessToken: string): Promise<{
  id: string;
  username?: string;
  name?: string;
}> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    user?: { id?: string; username?: string; name?: string };
    id?: string;
    username?: string;
    name?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Vercel /v2/user failed (${res.status})`);
  }
  const user = json.user ?? json;
  if (!user.id) {
    throw new Error("Vercel user response missing id");
  }
  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
  };
}

export type VercelTeam = { id: string; name: string; slug?: string };

export async function listVercelTeams(accessToken: string): Promise<VercelTeam[]> {
  const res = await fetch("https://api.vercel.com/v2/teams", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    teams?: Array<{ id: string; name: string; slug?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Vercel /v2/teams failed (${res.status})`);
  }
  return (json.teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
  }));
}

/** Stable project name for Vercel (lowercase, hyphenated, unique-ish). */
export function vercelProjectNameForOpenOx(projectId: string, displayName?: string): string {
  const base = (displayName?.trim() || projectId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = createHash("sha256").update(projectId).digest("hex").slice(0, 8);
  const stem = base || "open-ox";
  return `${stem}-${suffix}`.slice(0, 52);
}
