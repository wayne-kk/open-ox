import { describe, expect, it } from "vitest";
import {
  clampToViewport,
  measureTourTarget,
  placeTourPopover,
  resolvePlacement,
} from "@/components/onboarding/spotlight";

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("product tour spotlight helpers", () => {
  it("centers when there is no target", () => {
    expect(resolvePlacement("auto", null)).toBe("center");
    const pos = placeTourPopover("center", null, { width: 360, height: 200 });
    expect(pos.top).toBeGreaterThan(0);
    expect(pos.left).toBeGreaterThan(0);
  });

  it("respects explicit placement when there is room", () => {
    const target = { top: 80, left: 200, width: 120, height: 40 };
    expect(resolvePlacement("bottom", target, { width: 200, height: 100 })).toBe("bottom");
    const pos = placeTourPopover("bottom", target, { width: 200, height: 100 });
    expect(pos.top).toBeGreaterThanOrEqual(80 + 40);
  });

  it("falls back when preferred side has no room", () => {
    const target = { top: 700, left: 100, width: 80, height: 40 };
    const placement = resolvePlacement("bottom", target, { width: 200, height: 280 });
    expect(placement).not.toBe("bottom");
  });

  it("keeps the full card inside the viewport", () => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const pos = clampToViewport({ top: 900, left: 40 }, 360, 280);
    expect(pos.top + 280).toBeLessThanOrEqual(vh - 8);
    expect(pos.top).toBeGreaterThanOrEqual(16);
  });

  it("parks bottom-left targets' card in a safe on-screen corner", () => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const target = { top: vh - 80, left: 16, width: 200, height: 52 };
    const pos = placeTourPopover("right", target, { width: 360, height: 280 });
    expect(pos.top).toBeGreaterThanOrEqual(16);
    expect(pos.top + 280).toBeLessThanOrEqual(vh - 8);
    expect(pos.left + 360).toBeLessThanOrEqual(vw - 8);
  });

  it("can shrink a tall container spotlight to its visible content height", () => {
    const style = {
      display: "block",
      visibility: "visible",
      opacity: "1",
      borderTopLeftRadius: "12px",
    };
    const message = { getBoundingClientRect: () => rect(60, 48, 240, 120) };
    const target = {
      getBoundingClientRect: () => rect(40, 20, 300, 500),
      querySelectorAll: () => [message],
    };
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousCss = globalThis.CSS;

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelectorAll: () => [target] },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        innerWidth: 1200,
        innerHeight: 800,
        getComputedStyle: () => style,
      },
    });
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (s: string) => s },
    });

    try {
      const measured = measureTourTarget("conversation", 8, {
        align: "start",
        contentSelector: ":scope > *",
        contentAxis: "vertical",
        maxHeightRatio: 1,
        maxHeightPx: 420,
      });

      expect(measured).toMatchObject({
        top: 52,
        left: 12,
        width: 316,
        height: 136,
      });
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
      Object.defineProperty(globalThis, "CSS", {
        configurable: true,
        value: previousCss,
      });
    }
  });
});
