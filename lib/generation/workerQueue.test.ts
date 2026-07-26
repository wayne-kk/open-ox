import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  claimGenerationRunById,
  loadRecoverableGenerationRunIds,
} from "./workerQueue";

describe("claimGenerationRunById", () => {
  it("claims exactly the run carried by the Redis job", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "run-1", project_id: "project-1", payload: {} }],
      error: null,
    });

    const result = await claimGenerationRunById(
      { rpc } as unknown as SupabaseClient,
      { runId: "run-1", workerId: "worker-1", leaseSeconds: 240 },
    );

    expect(rpc).toHaveBeenCalledWith("claim_generation_run_by_id", {
      p_run_id: "run-1",
      p_worker: "worker-1",
      p_lease_seconds: 240,
    });
    expect(result?.id).toBe("run-1");
  });

  it("treats duplicate or stale notifications as already handled", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(
      claimGenerationRunById({ rpc } as unknown as SupabaseClient, {
        runId: "run-1",
        workerId: "worker-1",
        leaseSeconds: 240,
      }),
    ).resolves.toBeNull();
  });
});

function recoveryQuery(data: Array<{ id: string }>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  return query;
}

describe("loadRecoverableGenerationRunIds", () => {
  it("returns queued and expired run ids without duplicates", async () => {
    const queued = recoveryQuery([{ id: "queued" }, { id: "same" }]);
    const expired = recoveryQuery([{ id: "expired" }, { id: "same" }]);
    const from = vi.fn().mockReturnValueOnce(queued).mockReturnValueOnce(expired);

    await expect(
      loadRecoverableGenerationRunIds(
        { from } as unknown as SupabaseClient,
        new Date("2026-07-26T00:00:00.000Z"),
      ),
    ).resolves.toEqual(["queued", "same", "expired"]);
    expect(expired.lt).toHaveBeenCalledWith(
      "lease_until",
      "2026-07-26T00:00:00.000Z",
    );
  });
});
