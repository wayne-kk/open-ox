import { describe, expect, it } from "vitest";
import { computeFloatingEditorPosition } from "./floatingEditorPosition";

describe("computeFloatingEditorPosition", () => {
  it("places popup below the anchor by default", () => {
    const pos = computeFloatingEditorPosition(
      { top: 40, left: 20, width: 100, height: 24 },
      { top: 0, left: 0 },
      { width: 400, height: 600 },
      { width: 280, height: 200 }
    );
    expect(pos.top).toBe(72);
    expect(pos.left).toBe(20);
  });

  it("flips above when there is not enough space below", () => {
    const pos = computeFloatingEditorPosition(
      { top: 500, left: 10, width: 80, height: 30 },
      { top: 0, left: 0 },
      { width: 400, height: 560 },
      { width: 280, height: 200 }
    );
    expect(pos.top).toBeLessThan(500);
  });
});
