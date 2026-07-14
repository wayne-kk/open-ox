/**
 * In-process flag: after /clear, next plain DM should not continue awaitingReply.
 * Process-local (same caveat as modify in-flight lock).
 */

const suppressUntil = new Map<string, number>();

export function suppressContinuation(userId: string, ttlMs = 30 * 60 * 1000): void {
  suppressUntil.set(userId, Date.now() + ttlMs);
}

export function clearContinuationSuppress(userId: string): void {
  suppressUntil.delete(userId);
}

export function shouldSuppressContinuation(userId: string): boolean {
  const until = suppressUntil.get(userId);
  if (until == null) return false;
  if (Date.now() > until) {
    suppressUntil.delete(userId);
    return false;
  }
  return true;
}

export function __resetContinuationSuppressForTests(): void {
  suppressUntil.clear();
}
