import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getProject, updateProjectStatus } = vi.hoisted(() => ({
  getProject: vi.fn().mockResolvedValue(null),
  updateProjectStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/projectManager", () => ({
  getProject,
  updateProjectStatus,
}));
vi.mock("@/lib/analytics/serverEvents", () => ({
  trackServerAnalyticsEventFireAndForget: vi.fn(),
}));

import { enqueueGenerationJob } from "./enqueueGenerationJob";

function dbHarness(
  activeRows: Array<{ id: string; status: "queued" | "running" }> = [],
) {
  const insert = vi.fn().mockReturnValue({
    select: () => ({
      single: async () => ({ data: { id: "run-1" }, error: null }),
    }),
  });
  const activeQuery = {
    eq: () => ({
      in: async () => ({ data: activeRows, error: null }),
    }),
  };
  const claimBuilder = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: activeRows[0]?.id },
      error: null,
    }),
  };
  claimBuilder.eq.mockReturnValue(claimBuilder);
  claimBuilder.select.mockReturnValue(claimBuilder);
  const update = vi.fn().mockReturnValue(claimBuilder);
  const from = vi.fn().mockReturnValue({
    select: () => activeQuery,
    insert,
    update,
  });
  return { db: { from } as unknown as SupabaseClient, insert, update };
}

const payload = {
  requestingUserId: "user-1",
  effectivePrompt: "Build a site",
  effectiveGenerationMode: "web",
  resumeFromCheckpoint: false,
  enableSkills: true,
  enableIntentGuide: true,
  useDatabasePrompts: false,
};

describe("enqueueGenerationJob", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("inserts inline jobs already running and leased, closing the worker race", async () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");
    const { db, insert } = dbHarness();

    const result = await enqueueGenerationJob({
      db,
      projectId: "project-1",
      ownerUserId: "user-1",
      kind: "new",
      resumeFromCheckpoint: false,
      payload,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        lease_owner: expect.stringMatching(/^inline-next-dev:/),
        lease_until: expect.any(String),
        last_heartbeat_at: expect.any(String),
      }),
    );
    expect(result.shouldScheduleInline).toBe(true);
  });

  it("leaves standalone-worker jobs queued", async () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "0");
    const { db, insert } = dbHarness();

    const result = await enqueueGenerationJob({
      db,
      projectId: "project-1",
      ownerUserId: "user-1",
      kind: "new",
      resumeFromCheckpoint: false,
      payload,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued" }),
    );
    expect(insert.mock.calls[0]?.[0]).not.toHaveProperty("lease_owner");
    expect(result.shouldScheduleInline).toBe(false);
  });

  it("atomically leases an older queued run when inline mode attaches", async () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");
    const { db, insert, update } = dbHarness([
      { id: "queued-run", status: "queued" },
    ]);

    const result = await enqueueGenerationJob({
      db,
      projectId: "project-1",
      ownerUserId: "user-1",
      kind: "resume",
      resumeFromCheckpoint: true,
      payload,
    });

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        lease_owner: expect.stringMatching(/^inline-next-dev:/),
      }),
    );
    expect(result).toEqual({
      runId: "queued-run",
      attached: true,
      shouldScheduleInline: true,
    });
  });

  it("does not schedule a second executor for an attached running run", async () => {
    vi.stubEnv("OPEN_OX_INLINE_GENERATION", "1");
    const { db, insert, update } = dbHarness([
      { id: "running-run", status: "running" },
    ]);

    const result = await enqueueGenerationJob({
      db,
      projectId: "project-1",
      ownerUserId: "user-1",
      kind: "resume",
      resumeFromCheckpoint: true,
      payload,
    });

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result.shouldScheduleInline).toBe(false);
  });
});
