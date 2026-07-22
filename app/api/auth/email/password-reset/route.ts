import { type NextRequest } from "next/server";
import { checkEmailAuthRateLimit } from "@/lib/auth/email-auth-rate-limit";
import { createEmailAuthSupabaseClient } from "@/lib/auth/email-auth-server";
import {
  normalizeEmail,
  normalizeSupabaseAuthError,
  validateEmailAndPassword,
} from "@/lib/auth/email-auth-shared";
import { getPublicOrigin } from "@/lib/auth/request-origin";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const { supabase, json } = createEmailAuthSupabaseClient(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "unknown", message: "Invalid JSON" }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return json({ ok: false, code: "unknown", message: "Invalid body" }, { status: 400 });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const validation = validateEmailAndPassword({ email });
  if (validation) return json(validation, { status: 400 });

  const limited = checkEmailAuthRateLimit({
    action: "password_reset",
    email,
    headers: request.headers,
  });
  if (!limited.ok) {
    return json(
      { ok: false, code: "rateLimited", message: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getPublicOrigin(request)}/auth/callback?next=${encodeURIComponent(
      "/auth?mode=reset"
    )}`,
  });
  if (error) return json(normalizeSupabaseAuthError(error), { status: error.status ?? 400 });
  return json({ ok: true });
}
