/**
 * Project-scoped Modify in-flight lock.
 * Process-local: enough for single-instance dogfood; multi-instance may still race.
 */

const locks = new Map<string, { startedAt: number }>();

export function isModifyInFlight(projectId: string): boolean {
  return locks.has(projectId);
}

/** @returns true if this caller now holds the lock */
export function tryAcquireModifyInFlight(projectId: string): boolean {
  if (locks.has(projectId)) return false;
  locks.set(projectId, { startedAt: Date.now() });
  return true;
}

export function releaseModifyInFlight(projectId: string): void {
  locks.delete(projectId);
}

/** Test-only: clear all locks between cases. */
export function __resetModifyInFlightForTests(): void {
  locks.clear();
}
