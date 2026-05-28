import { describe, expect, it } from "vitest";

import { canUseInstantStaticPreview } from "./staticSitePreviewFastPath";

describe("canUseInstantStaticPreview", () => {
  const origin = "abc123def4567890";

  it("returns true when synced_at and aggregate files_hash match origin", () => {
    expect(
      canUseInstantStaticPreview({
        filesHash: `deadbeefcafebabe:${origin}`,
        staticPreviewSyncedAt: "2026-05-28T08:00:00.000Z",
        currentOriginFingerprint: origin,
      })
    ).toBe(true);
  });

  it("returns false when force rebuild", () => {
    expect(
      canUseInstantStaticPreview({
        force: true,
        filesHash: `deadbeefcafebabe:${origin}`,
        staticPreviewSyncedAt: "2026-05-28T08:00:00.000Z",
        currentOriginFingerprint: origin,
      })
    ).toBe(false);
  });

  it("returns false without static_preview_synced_at", () => {
    expect(
      canUseInstantStaticPreview({
        filesHash: `deadbeefcafebabe:${origin}`,
        staticPreviewSyncedAt: null,
        currentOriginFingerprint: origin,
      })
    ).toBe(false);
  });

  it("returns false when origin fingerprint changed", () => {
    expect(
      canUseInstantStaticPreview({
        filesHash: `deadbeefcafebabe:${origin}`,
        staticPreviewSyncedAt: "2026-05-28T08:00:00.000Z",
        currentOriginFingerprint: "otherorigin00000",
      })
    ).toBe(false);
  });
});
