import type { SupabaseClient } from "@supabase/supabase-js";

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

/**
 * Ensures auth.users has this Feishu user, then signs in with email/password on sessionClient (sets cookies on response).
 */
export async function provisionFeishuUserAndSignIn(
  admin: SupabaseClient,
  sessionClient: SupabaseClient,
  args: {
    email: string;
    password: string;
    userMetadata: Record<string, unknown>;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { email, password, userMetadata } = args;

  const first = await sessionClient.auth.signInWithPassword({ email, password });
  if (!first.error) return { ok: true };

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!created.error) {
    const second = await sessionClient.auth.signInWithPassword({ email, password });
    if (second.error) return { ok: false, message: second.error.message };
    return { ok: true };
  }

  const msg = created.error.message ?? "";
  const looksDuplicate =
    /already|registered|exists|duplicate/i.test(msg) || (created.error as { status?: number }).status === 422;

  if (!looksDuplicate) {
    return { ok: false, message: msg || "createUser failed" };
  }

  const uid = await findUserIdByEmail(admin, email);
  if (!uid) {
    return { ok: false, message: msg || "User may exist but could not be resolved" };
  }

  const updated = await admin.auth.admin.updateUserById(uid, {
    password,
    user_metadata: userMetadata,
  });
  if (updated.error) {
    return { ok: false, message: updated.error.message };
  }

  const third = await sessionClient.auth.signInWithPassword({ email, password });
  if (third.error) return { ok: false, message: third.error.message };
  return { ok: true };
}
