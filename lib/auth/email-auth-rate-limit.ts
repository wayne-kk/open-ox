type EmailAuthRateLimitAction = "register" | "resend_verification" | "password_reset";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const ACTION_LIMITS: Record<EmailAuthRateLimitAction, { limit: number; windowMs: number }> = {
  register: { limit: 5, windowMs: 10 * 60 * 1000 },
  resend_verification: { limit: 3, windowMs: 10 * 60 * 1000 },
  password_reset: { limit: 3, windowMs: 10 * 60 * 1000 },
};

function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function checkEmailAuthRateLimit(params: {
  action: EmailAuthRateLimitAction;
  email: string;
  headers: Headers;
  nowMs?: number;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const nowMs = params.nowMs ?? Date.now();
  const { limit, windowMs } = ACTION_LIMITS[params.action];
  const key = `${params.action}:${clientIpFromHeaders(params.headers)}:${params.email}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

export function clearEmailAuthRateLimitForTests(): void {
  buckets.clear();
}
