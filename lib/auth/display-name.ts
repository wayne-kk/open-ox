import type { User } from "@supabase/supabase-js";

const FEISHU_PLACEHOLDER_DOMAIN = "@feishu.open-ox.local";

export function isPlaceholderAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith(FEISHU_PLACEHOLDER_DOMAIN);
}

/**
 * Human-readable label for grouping / denormalized storage (e.g. projects.owner_username).
 */
export function getUserDisplayName(user: User): string {
  const m = user.user_metadata as Record<string, unknown>;
  const fromMeta =
    (typeof m.full_name === "string" && m.full_name.trim()) ||
    (typeof m.name === "string" && m.name.trim()) ||
    (typeof m.preferred_username === "string" && m.preferred_username.trim()) ||
    (typeof m.nickname === "string" && m.nickname.trim()) ||
    "";
  if (fromMeta) return fromMeta;
  const email = user.email ?? "";
  if (email && !isPlaceholderAccountEmail(email)) {
    const local = email.split("@")[0];
    return local || "用户";
  }
  return "用户";
}
