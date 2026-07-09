import { describe, expect, it } from "vitest";
import { hasUsableStaticPreview } from "@/lib/projectManager";

describe("hasUsableStaticPreview", () => {
  it("requires non-empty staticPreviewSyncedAt", () => {
    expect(hasUsableStaticPreview({ status: "ready", staticPreviewSyncedAt: "2026-07-09T00:00:00Z" })).toBe(
      true
    );
    expect(hasUsableStaticPreview({ status: "ready", staticPreviewSyncedAt: null })).toBe(false);
    expect(hasUsableStaticPreview({ status: "ready", staticPreviewSyncedAt: "  " })).toBe(false);
    expect(hasUsableStaticPreview({ status: "ready" })).toBe(false);
  });
});
