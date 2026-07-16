import { describe, expect, it } from "vitest";
import { placeTourPopover, resolvePlacement } from "@/components/onboarding/spotlight";

describe("product tour spotlight helpers", () => {
  it("centers when there is no target", () => {
    expect(resolvePlacement("auto", null)).toBe("center");
    const pos = placeTourPopover("center", null, { width: 360, height: 200 });
    expect(pos.top).toBeGreaterThan(0);
    expect(pos.left).toBeGreaterThan(0);
  });

  it("respects explicit placement with a target", () => {
    const target = { top: 100, left: 100, width: 80, height: 40 };
    expect(resolvePlacement("bottom", target)).toBe("bottom");
    const pos = placeTourPopover("bottom", target, { width: 200, height: 100 });
    expect(pos.top).toBeGreaterThanOrEqual(100 + 40);
  });
});
