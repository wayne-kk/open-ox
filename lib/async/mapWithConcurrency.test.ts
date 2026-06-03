import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("preserves order with concurrency", async () => {
    const items = [1, 2, 3, 4, 5];
    const out = await mapWithConcurrency(items, 3, async (n) => {
      await new Promise((r) => setTimeout(r, 5));
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });
});
