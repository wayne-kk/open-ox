export const EMAIL_PASSWORD_MIN_LENGTH = 8;

export type EmailAuthErrorCode =
  | "invalidEmail"
  | "passwordShort"
  | "passwordMismatch"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "rateLimited"
  | "config"
  | "unknown";

export type EmailAuthResult =
  | { ok: true; needsEmailConfirmation?: false }
  | { ok: true; needsEmailConfirmation: true; email: string }
  | { ok: false; code: EmailAuthErrorCode; message: string };

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateEmailAndPassword(input: {
  email: string;
  password?: string;
  confirmPassword?: string;
}): EmailAuthResult | null {
  if (!isValidEmail(input.email)) {
    return { ok: false, code: "invalidEmail", message: "Invalid email" };
  }
  return validatePasswordConfirmation(input);
}

export function validatePasswordConfirmation(input: {
  password?: string;
  confirmPassword?: string;
}): EmailAuthResult | null {
  if (input.password != null && input.password.length < EMAIL_PASSWORD_MIN_LENGTH) {
    return { ok: false, code: "passwordShort", message: "Password is too short" };
  }
  if (
    input.password != null &&
    input.confirmPassword != null &&
    input.password !== input.confirmPassword
  ) {
    return { ok: false, code: "passwordMismatch", message: "Passwords do not match" };
  }
  return null;
}

export function normalizeSupabaseAuthError(error: {
  message?: string;
  code?: string;
  status?: number;
}): EmailAuthResult {
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return { ok: false, code: "invalidCredentials", message: error.message ?? "" };
  }

  if (message.includes("email not confirmed") || code.includes("email_not_confirmed")) {
    return { ok: false, code: "emailNotConfirmed", message: error.message ?? "" };
  }

  if (error.status === 429 || message.includes("rate limit") || message.includes("too many")) {
    return { ok: false, code: "rateLimited", message: error.message ?? "" };
  }

  if (message.includes("supabase") && message.includes("missing")) {
    return { ok: false, code: "config", message: error.message ?? "" };
  }

  return { ok: false, code: "unknown", message: error.message ?? "" };
}
