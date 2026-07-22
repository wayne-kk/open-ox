import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  normalizeEmail,
  normalizeSupabaseAuthError,
  validateEmailAndPassword,
  validatePasswordConfirmation,
  type EmailAuthResult,
} from "@/lib/auth/email-auth-shared";

export {
  EMAIL_PASSWORD_MIN_LENGTH,
  isValidEmail,
  normalizeEmail,
  normalizeSupabaseAuthError,
  validateEmailAndPassword,
  validatePasswordConfirmation,
  type EmailAuthErrorCode,
  type EmailAuthResult,
} from "@/lib/auth/email-auth-shared";

async function markEmailAuthSuccess(): Promise<void> {
  const response = await fetch("/api/auth/email/post-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`post-login failed: ${response.status}`);
  }
}

export async function registerWithEmail(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  next: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  const validation = validateEmailAndPassword({
    email,
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (validation) return validation;

  const response = await fetch("/api/auth/email/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: input.password,
      confirmPassword: input.confirmPassword,
      name: input.name,
      next: input.next,
    }),
  });
  const payload = (await response.json().catch(() => null)) as EmailAuthResult | null;
  if (payload) return payload;
  if (response.status === 429) {
    return { ok: false, code: "rateLimited", message: "Rate limited" };
  }
  return { ok: false, code: "unknown", message: "Registration failed" };
}

export async function completeEmailLogin(): Promise<EmailAuthResult> {
  try {
    await markEmailAuthSuccess();
    return { ok: true };
  } catch (err) {
    return normalizeSupabaseAuthError(err instanceof Error ? err : { message: String(err) });
  }
}

export async function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  const validation = validateEmailAndPassword({ email });
  if (validation) return validation;

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error) return normalizeSupabaseAuthError(error);
    return completeEmailLogin();
  } catch (err) {
    return normalizeSupabaseAuthError(err instanceof Error ? err : { message: String(err) });
  }
}

export async function resendVerificationEmail(input: {
  email: string;
  next: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  const validation = validateEmailAndPassword({ email });
  if (validation) return validation;

  const response = await fetch("/api/auth/email/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      next: input.next,
    }),
  });
  const payload = (await response.json().catch(() => null)) as EmailAuthResult | null;
  if (payload) return payload;
  if (response.status === 429) return { ok: false, code: "rateLimited", message: "Rate limited" };
  return { ok: false, code: "unknown", message: "Resend failed" };
}

export async function requestPasswordResetEmail(input: {
  email: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  const validation = validateEmailAndPassword({ email });
  if (validation) return validation;

  const response = await fetch("/api/auth/email/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = (await response.json().catch(() => null)) as EmailAuthResult | null;
  if (payload) return payload;
  if (response.status === 429) return { ok: false, code: "rateLimited", message: "Rate limited" };
  return { ok: false, code: "unknown", message: "Password reset failed" };
}

export async function updatePasswordFromRecovery(input: {
  password: string;
  confirmPassword: string;
}): Promise<EmailAuthResult> {
  const validation = validatePasswordConfirmation({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (validation) return validation;

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) return normalizeSupabaseAuthError(error);
    return { ok: true };
  } catch (err) {
    return normalizeSupabaseAuthError(err instanceof Error ? err : { message: String(err) });
  }
}
