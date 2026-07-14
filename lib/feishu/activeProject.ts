import type { SupabaseClient } from "@supabase/supabase-js";
import { getProject } from "@/lib/projectManager";
import { isProjectOwner } from "@/lib/auth/projectAccess";

export type FeishuActiveProject = {
  projectId: string | null;
  projectName: string | null;
};

export type SetFeishuActiveProjectResult =
  | { ok: true; projectId: string | null; projectName: string | null }
  | { ok: false; code: "PROJECT_NOT_FOUND" | "FORBIDDEN"; message: string };

async function settingsRowExists(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("user_feishu_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`[feishu] settings lookup failed: ${error.message}`);
  }
  return Boolean(data?.user_id);
}

/**
 * Persist Feishu open_id → user_id so the Bot can resolve DM senders.
 * Does not clear active_project_id.
 */
export async function linkFeishuOpenId(
  db: SupabaseClient,
  userId: string,
  openId: string
): Promise<void> {
  const trimmed = openId.trim();
  if (!trimmed) return;
  const now = new Date().toISOString();
  const exists = await settingsRowExists(db, userId);
  const { error } = exists
    ? await db
        .from("user_feishu_settings")
        .update({ feishu_open_id: trimmed, updated_at: now })
        .eq("user_id", userId)
    : await db.from("user_feishu_settings").insert({
        user_id: userId,
        feishu_open_id: trimmed,
        updated_at: now,
      });
  if (error) {
    console.warn(`[feishu] link open_id failed: ${error.message}`);
  }
}

async function findUserIdByMetadataOpenId(
  admin: SupabaseClient,
  openId: string
): Promise<string | null> {
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 25; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => {
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      return typeof meta?.feishu_open_id === "string" && meta.feishu_open_id === openId;
    });
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

/**
 * Resolve Bot sender open_id → Open-OX user_id.
 * 1) user_feishu_settings  2) auth user_metadata.feishu_open_id (backfill settings)
 */
export async function resolveUserIdByFeishuOpenId(
  db: SupabaseClient,
  openId: string
): Promise<string | null> {
  const trimmed = openId.trim();
  if (!trimmed) return null;
  const { data, error } = await db
    .from("user_feishu_settings")
    .select("user_id")
    .eq("feishu_open_id", trimmed)
    .maybeSingle();
  if (error) {
    throw new Error(`[feishu] resolve open_id failed: ${error.message}`);
  }
  if (typeof data?.user_id === "string") return data.user_id;

  // Legacy: Feishu login before settings table / link failed — recover from metadata
  const fromMeta = await findUserIdByMetadataOpenId(db, trimmed);
  if (fromMeta) {
    await linkFeishuOpenId(db, fromMeta, trimmed);
    return fromMeta;
  }
  return null;
}

/**
 * Read the user's Feishu active project pointer (may be null / cleared).
 */
export async function getFeishuActiveProject(
  db: SupabaseClient,
  userId: string
): Promise<FeishuActiveProject> {
  const { data, error } = await db
    .from("user_feishu_settings")
    .select("active_project_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[feishu] get active project failed: ${error.message}`);
  }

  const projectId =
    typeof data?.active_project_id === "string" && data.active_project_id.trim()
      ? data.active_project_id.trim()
      : null;

  if (!projectId) {
    return { projectId: null, projectName: null };
  }

  const project = await getProject(db, projectId);
  if (!project || !isProjectOwner(project, userId)) {
    return { projectId: null, projectName: null };
  }

  return {
    projectId,
    projectName: typeof project.name === "string" ? project.name : null,
  };
}

async function writeActiveProjectId(
  db: SupabaseClient,
  userId: string,
  activeProjectId: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const exists = await settingsRowExists(db, userId);
  const { error } = exists
    ? await db
        .from("user_feishu_settings")
        .update({ active_project_id: activeProjectId, updated_at: now })
        .eq("user_id", userId)
    : await db.from("user_feishu_settings").insert({
        user_id: userId,
        active_project_id: activeProjectId,
        updated_at: now,
      });
  if (error) {
    throw new Error(`[feishu] write active project failed: ${error.message}`);
  }
}

/**
 * Set or clear the Feishu active project. `projectId: null` clears.
 * Only the owner may point at a project. Does not clear feishu_open_id.
 */
export async function setFeishuActiveProject(
  db: SupabaseClient,
  userId: string,
  projectId: string | null
): Promise<SetFeishuActiveProjectResult> {
  if (projectId === null) {
    await writeActiveProjectId(db, userId, null);
    return { ok: true, projectId: null, projectName: null };
  }

  const project = await getProject(db, projectId);
  if (!project) {
    return { ok: false, code: "PROJECT_NOT_FOUND", message: "Project not found" };
  }
  if (!isProjectOwner(project, userId)) {
    return { ok: false, code: "FORBIDDEN", message: "Not project owner" };
  }

  await writeActiveProjectId(db, userId, projectId);

  return {
    ok: true,
    projectId,
    projectName: typeof project.name === "string" ? project.name : null,
  };
}

/** Applink that opens a 1:1 chat with this Feishu app bot. */
export function buildFeishuBotOpenUrl(appId = process.env.FEISHU_APP_ID?.trim()): string | null {
  if (!appId) return null;
  return `https://applink.feishu.cn/client/bot/open?appId=${encodeURIComponent(appId)}`;
}
