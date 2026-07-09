import { describe, expect, it } from "vitest";
import { applyDirectVisualEdits } from "./applyDirectPatch";
import type { VisualEdit } from "../protocol";

describe("applyDirectVisualEdits", () => {
  it("rejects edits without source coordinates (no rg fallback)", async () => {
    const edits: VisualEdit[] = [
      {
        kind: "style",
        selectorHint: "h1.title",
        elementLabel: "h1.title",
        property: "color",
        before: "#fff",
        after: "#f00",
      },
    ];
    const result = await applyDirectVisualEdits("/tmp/unused", edits);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_SOURCE_MAPPING");
    }
  });
});
