export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

const STORAGE_KEY = "open-ox:auth:verification-resend";

export type VerificationResendState = {
  email: string;
  resendAvailableAt: number;
};

export function readVerificationResendState(storage: Storage): VerificationResendState | null {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("email" in parsed) ||
      typeof parsed.email !== "string" ||
      !("resendAvailableAt" in parsed) ||
      typeof parsed.resendAvailableAt !== "number" ||
      !Number.isFinite(parsed.resendAvailableAt)
    ) {
      return null;
    }
    return { email: parsed.email, resendAvailableAt: parsed.resendAvailableAt };
  } catch {
    return null;
  }
}

export function writeVerificationResendState(
  storage: Storage,
  state: VerificationResendState
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Auth remains usable when storage is unavailable or full.
  }
}

export function verificationResendSecondsRemaining(
  resendAvailableAt: number,
  nowMs: number = Date.now()
): number {
  return Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));
}
