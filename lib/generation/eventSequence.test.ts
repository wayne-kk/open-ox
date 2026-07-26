import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { loadLastGenerationEventSequence } from "./eventSequence";

function dbHarness(result: { data: { seq: number } | null; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return {
    db: { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient,
    query,
  };
}

describe("loadLastGenerationEventSequence", () => {
  it("continues a recovered run after its last persisted event", async () => {
    const { db, query } = dbHarness({ data: { seq: 3 }, error: null });

    await expect(loadLastGenerationEventSequence(db, "run-1")).resolves.toBe(3);
    expect(query.order).toHaveBeenCalledWith("seq", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("starts a new run at zero before the first increment", async () => {
    const { db } = dbHarness({ data: null, error: null });
    await expect(loadLastGenerationEventSequence(db, "run-1")).resolves.toBe(0);
  });

  it("does not silently restart numbering when the lookup fails", async () => {
    const { db } = dbHarness({
      data: null,
      error: { message: "database unavailable" },
    });
    await expect(loadLastGenerationEventSequence(db, "run-1")).rejects.toThrow(
      "failed to load last event sequence",
    );
  });
});

