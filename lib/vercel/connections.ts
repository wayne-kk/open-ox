import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { decryptSecret, encryptSecret } from "./crypto";

export type VercelConnectionPublic = {
  connected: true;
  vercelUserId: string | null;
  defaultTeamId: string | null;
  defaultTeamName: string | null;
  connectedAt: string;
};

export type VercelConnectionRow = {
  user_id: string;
  vercel_user_id: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  default_team_id: string | null;
  default_team_name: string | null;
  configuration_id: string | null;
  connected_at: string;
  updated_at: string;
};

function admin(): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

export async function getVercelConnectionPublic(
  userId: string
): Promise<VercelConnectionPublic | { connected: false }> {
  const { data, error } = await admin()
    .from("user_vercel_connections")
    .select("vercel_user_id, default_team_id, default_team_name, connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`[vercel] get connection failed: ${error.message}`);
  }
  if (!data) return { connected: false };
  return {
    connected: true,
    vercelUserId: data.vercel_user_id ?? null,
    defaultTeamId: data.default_team_id ?? null,
    defaultTeamName: data.default_team_name ?? null,
    connectedAt: data.connected_at,
  };
}

export async function getVercelAccessToken(userId: string): Promise<{
  accessToken: string;
  teamId: string | null;
  teamName: string | null;
} | null> {
  const { data, error } = await admin()
    .from("user_vercel_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`[vercel] load connection failed: ${error.message}`);
  }
  if (!data) return null;
  const row = data as VercelConnectionRow;
  return {
    accessToken: decryptSecret(row.access_token_enc),
    teamId: row.default_team_id,
    teamName: row.default_team_name,
  };
}

export async function upsertVercelConnection(params: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  vercelUserId?: string | null;
  defaultTeamId?: string | null;
  defaultTeamName?: string | null;
  configurationId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin().from("user_vercel_connections").upsert(
    {
      user_id: params.userId,
      access_token_enc: encryptSecret(params.accessToken),
      refresh_token_enc: params.refreshToken ? encryptSecret(params.refreshToken) : null,
      token_expires_at: params.tokenExpiresAt ?? null,
      vercel_user_id: params.vercelUserId ?? null,
      default_team_id: params.defaultTeamId ?? null,
      default_team_name: params.defaultTeamName ?? null,
      configuration_id: params.configurationId ?? null,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw new Error(`[vercel] upsert connection failed: ${error.message}`);
  }
}

export async function updateVercelDefaultTeam(params: {
  userId: string;
  teamId: string | null;
  teamName: string | null;
}): Promise<void> {
  const { error } = await admin()
    .from("user_vercel_connections")
    .update({
      default_team_id: params.teamId,
      default_team_name: params.teamName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);
  if (error) {
    throw new Error(`[vercel] update team failed: ${error.message}`);
  }
}

/**
 * Disconnect: drop OAuth tokens and clear project deploy bindings for this user's projects.
 * Does not delete remote Vercel projects.
 */
export async function disconnectVercel(userId: string): Promise<void> {
  const db = admin();
  const { data: projects, error: listErr } = await db
    .from("projects")
    .select("id")
    .eq("user_id", userId);
  if (listErr) {
    throw new Error(`[vercel] list projects for disconnect failed: ${listErr.message}`);
  }
  const ids = (projects ?? []).map((p) => String(p.id));
  if (ids.length > 0) {
    const { error: clearErr } = await db
      .from("project_vercel_deployments")
      .delete()
      .in("project_id", ids);
    if (clearErr) {
      throw new Error(`[vercel] clear deploy bindings failed: ${clearErr.message}`);
    }
  }
  const { error } = await db.from("user_vercel_connections").delete().eq("user_id", userId);
  if (error) {
    throw new Error(`[vercel] delete connection failed: ${error.message}`);
  }
}
