import { type NextRequest } from "next/server";
import { checkEmailAuthRateLimit } from "@/lib/auth/email-auth-rate-limit";
import { createEmailAuthSupabaseClient } from "@/lib/auth/email-auth-server";
import {
  normalizeEmail,
  normalizeSupabaseAuthError,
  validateEmailAndPassword,
} from "@/lib/auth/email-auth-shared";
import { finalizeAuthenticatedLogin } from "@/lib/auth/post-login";
import { getPublicOrigin } from "@/lib/auth/request-origin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

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
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const next = safeRedirectTarget(typeof body.next === "string" ? body.next : "/dashboard");
  const validation = validateEmailAndPassword({ email, password, confirmPassword });
  if (validation) return json(validation, { status: 400 });

  const limited = checkEmailAuthRateLimit({
    action: "register",
    email,
    headers: request.headers,
  });
  if (!limited.ok) {
    return json(
      { ok: false, code: "rateLimited", message: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const fullName = typeof body.name === "string" ? body.name.trim() : "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getPublicOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        provider: "email",
        ...(fullName ? { full_name: fullName, name: fullName } : {}),
      },
    },
  });

  if (error) return json(normalizeSupabaseAuthError(error), { status: error.status ?? 400 });

  if (data.session && data.user) {
    await finalizeAuthenticatedLogin({ request, supabase, user: data.user, provider: "email" });
    return json({ ok: true });
  }

  return json({ ok: true, needsEmailConfirmation: true, email });
}
