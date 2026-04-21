import type { SupabaseClient } from "@supabase/supabase-js";

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function safeSignInWithPassword(
  sessionClient: SupabaseClient,
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; message: string; transient: boolean }> {
  try {
    const result = await sessionClient.auth.signInWithPassword({ email, password });
    if (!result.error) return { ok: true };
    return { ok: false, message: result.error.message, transient: false };
  } catch (error) {
    const message = errorMessageFromUnknown(error);
    const transient = /timeout|fetch failed|network|connect/i.test(message);
    return { ok: false, message, transient };
  }
}

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

  const first = await safeSignInWithPassword(sessionClient, email, password);
  if (first.ok) return { ok: true };
  if (first.transient) {
    return { ok: false, message: `Supabase auth temporary unavailable: ${first.message}` };
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!created.error) {
    const second = await safeSignInWithPassword(sessionClient, email, password);
    if (!second.ok) return { ok: false, message: second.message };
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

  const third = await safeSignInWithPassword(sessionClient, email, password);
  if (!third.ok) return { ok: false, message: third.message };
  return { ok: true };
}
