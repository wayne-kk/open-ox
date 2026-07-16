import { describe, expect, it } from "vitest";
import {
  evaluateStudioCapabilities,
  type StudioCapability,
  type StudioCapabilitySnapshot,
} from "./evaluateStudioCapabilities";

const DELIVERY: StudioCapability[] = [
  "code",
  "preview",
  "deploy",
  "publishPreview",
  "feishuEdit",
];

function snap(
  partial: Partial<StudioCapabilitySnapshot> &
    Pick<StudioCapabilitySnapshot, "status">
): StudioCapabilitySnapshot {
  return {
    hydration: "ready",
    hasStaticPreview: true,
    hasOperableArtifact: true,
    ...partial,
  };
}

describe("evaluateStudioCapabilities", () => {
  it("allows topology when project is missing; denies everything else", () => {
    const caps = evaluateStudioCapabilities(null);
    expect(caps.topology).toEqual({ allowed: true });
    for (const key of DELIVERY) {
      expect(caps[key]).toEqual({ allowed: false, reason: "project_missing" });
    }
    expect(caps.history).toEqual({ allowed: false, reason: "project_missing" });
    expect(caps.modify).toEqual({ allowed: false, reason: "project_missing" });
  });

  it("denies delivery while hydrating; topology stays allowed", () => {
    const caps = evaluateStudioCapabilities(
      snap({ status: "ready", verificationStatus: "passed", hydration: "loading" })
    );
    expect(caps.topology).toEqual({ allowed: true });
    expect(caps.code).toEqual({ allowed: false, reason: "studio_loading" });
    expect(caps.preview).toEqual({ allowed: false, reason: "studio_loading" });
    expect(caps.deploy).toEqual({ allowed: false, reason: "studio_loading" });
  });

  it("allows all delivery when ready + verification passed + static preview", () => {
    const caps = evaluateStudioCapabilities(
      snap({ status: "ready", verificationStatus: "passed", hasStaticPreview: true })
    );
    for (const key of DELIVERY) {
      expect(caps[key]).toEqual({ allowed: true });
    }
    expect(caps.topology).toEqual({ allowed: true });
    expect(caps.history).toEqual({ allowed: true });
    expect(caps.modify).toEqual({ allowed: true });
  });

  it("blocks publishPreview when static preview is missing even if verified", () => {
    const caps = evaluateStudioCapabilities(
      snap({
        status: "ready",
        verificationStatus: "passed",
        hasStaticPreview: false,
      })
    );
    expect(caps.deploy).toEqual({ allowed: true });
    expect(caps.code).toEqual({ allowed: true });
    expect(caps.publishPreview).toEqual({
      allowed: false,
      reason: "static_preview_missing",
    });
  });

  it.each([
    ["awaiting_input", "awaiting_input"],
    ["generating", "generation_in_progress"],
    ["failed", "generation_failed"],
  ] as const)(
    "blocks delivery for status=%s with reason=%s",
    (status, reason) => {
      const caps = evaluateStudioCapabilities(snap({ status }));
      expect(caps.code).toEqual({ allowed: false, reason });
      expect(caps.preview).toEqual({ allowed: false, reason });
      expect(caps.deploy).toEqual({ allowed: false, reason });
      expect(caps.feishuEdit).toEqual({ allowed: false, reason });
      expect(caps.publishPreview).toEqual({ allowed: false, reason });
      expect(caps.topology).toEqual({ allowed: true });
    }
  );

  it("blocks delivery when ready but verification failed", () => {
    const caps = evaluateStudioCapabilities(
      snap({ status: "ready", verificationStatus: "failed" })
    );
    expect(caps.code).toEqual({
      allowed: false,
      reason: "verification_failed",
    });
    expect(caps.preview).toEqual({
      allowed: false,
      reason: "verification_failed",
    });
    expect(caps.deploy).toEqual({
      allowed: false,
      reason: "verification_failed",
    });
    expect(caps.topology).toEqual({ allowed: true });
  });

  it("blocks delivery when ready but verification missing", () => {
    const caps = evaluateStudioCapabilities(snap({ status: "ready" }));
    expect(caps.code).toEqual({
      allowed: false,
      reason: "verification_missing",
    });
    expect(caps.feishuEdit).toEqual({
      allowed: false,
      reason: "verification_missing",
    });
  });

  it("allows history/modify with operable artifact even when verification failed", () => {
    const caps = evaluateStudioCapabilities(
      snap({
        status: "ready",
        verificationStatus: "failed",
        hasOperableArtifact: true,
      })
    );
    expect(caps.history).toEqual({ allowed: true });
    expect(caps.modify).toEqual({ allowed: true });
    expect(caps.code).toEqual({
      allowed: false,
      reason: "verification_failed",
    });
  });

  it("denies history/modify without operable artifact", () => {
    const caps = evaluateStudioCapabilities(
      snap({
        status: "ready",
        verificationStatus: "passed",
        hasOperableArtifact: false,
      })
    );
    expect(caps.history).toEqual({
      allowed: false,
      reason: "no_operable_artifact",
    });
    expect(caps.modify).toEqual({
      allowed: false,
      reason: "no_operable_artifact",
    });
    expect(caps.code).toEqual({ allowed: true });
  });
});
