const INLINE_WORKER_ID = [
  "inline-next-dev",
  process.env.OPEN_OX_INLINE_WORKER_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    "local",
  process.pid,
].join(":");

export function generationLeaseSeconds(): number {
  return Math.max(
    60,
    Number.parseInt(
      process.env.OPEN_OX_GENERATION_LEASE_SECONDS ?? "240",
      10,
    ) || 240,
  );
}

export function inlineGenerationWorkerId(): string {
  return INLINE_WORKER_ID;
}

export function createInlineGenerationLease(now = new Date()) {
  const nowIso = now.toISOString();
  return {
    status: "running" as const,
    lease_owner: INLINE_WORKER_ID,
    lease_until: new Date(
      now.getTime() + generationLeaseSeconds() * 1000,
    ).toISOString(),
    last_heartbeat_at: nowIso,
    started_at: nowIso,
    updated_at: nowIso,
  };
}

export function shouldRunInlineGeneration(): boolean {
  const flag = process.env.OPEN_OX_INLINE_GENERATION?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function shouldRunStandaloneGenerationWorker(): boolean {
  return !shouldRunInlineGeneration();
}
