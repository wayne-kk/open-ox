import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInlineGenerationLease,
  shouldRunInlineGeneration,
  shouldRunStandaloneGenerationWorker,
} from "./inlineGeneration";

describe("generation executor mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prevents the standalone worker from claiming runs in inline mode", () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");

    expect(shouldRunInlineGeneration()).toBe(true);
    expect(shouldRunStandaloneGenerationWorker()).toBe(false);
  });

  it("uses the standalone worker when inline mode is disabled", () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "0");

    expect(shouldRunInlineGeneration()).toBe(false);
    expect(shouldRunStandaloneGenerationWorker()).toBe(true);
  });

  it("creates an active inline lease before a shared worker can claim the run", () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");
    vi.stubEnv("OPEN_OX_GENERATION_LEASE_SECONDS", "240");

    const lease = createInlineGenerationLease(new Date("2026-07-22T10:00:00Z"));

    expect(lease).toMatchObject({
      status: "running",
      lease_owner: expect.stringMatching(/^inline-next-dev:/),
      last_heartbeat_at: "2026-07-22T10:00:00.000Z",
      started_at: "2026-07-22T10:00:00.000Z",
    });
    expect(new Date(lease.lease_until).getTime()).toBe(
      new Date("2026-07-22T10:04:00Z").getTime(),
    );
  });
});
