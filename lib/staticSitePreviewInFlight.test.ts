import { describe, expect, it } from "vitest";

import {
  resolveInFlightSyncPolicy,
  shouldStampLocalFingerprintBeforeEnsure,
  staticExportFingerprintDrifted,
} from "./staticSitePreviewInFlight";

describe("resolveInFlightSyncPolicy", () => {
  it("runs immediately when nothing is in flight", () => {
    expect(resolveInFlightSyncPolicy({ hasInFlight: false, force: false })).toBe("run");
    expect(resolveInFlightSyncPolicy({ hasInFlight: false, force: true })).toBe("run");
  });

  it("joins a non-force caller onto the in-flight sync", () => {
    expect(resolveInFlightSyncPolicy({ hasInFlight: true, force: false })).toBe("join");
  });

  /**
   * Regression: Rebuild / post-generation must not inherit a mid-gen stub export.
   * Previously force:true still `return existing`, so Storage kept default page.tsx.
   */
  it("waits then re-runs when force:true while a sync is already in flight", () => {
    expect(resolveInFlightSyncPolicy({ hasInFlight: true, force: true })).toBe("wait-then-run");
  });
});

describe("staticExportFingerprintDrifted", () => {
  it("detects stub→real page fingerprint change during build", () => {
    expect(staticExportFingerprintDrifted("stubfp0000000001", "realfp0000000002")).toBe(true);
    expect(staticExportFingerprintDrifted("samefp0000000001", "samefp0000000001")).toBe(false);
  });
});

describe("shouldStampLocalFingerprintBeforeEnsure", () => {
  it("never stamps a Preparing stub fingerprint before restore", () => {
    expect(
      shouldStampLocalFingerprintBeforeEnsure({
        force: true,
        localHomeIsPreparingStub: true,
      })
    ).toBe(false);
  });

  it("allows force stamp only when local home is already real", () => {
    expect(
      shouldStampLocalFingerprintBeforeEnsure({
        force: true,
        localHomeIsPreparingStub: false,
      })
    ).toBe(true);
    expect(
      shouldStampLocalFingerprintBeforeEnsure({
        force: false,
        localHomeIsPreparingStub: false,
      })
    ).toBe(false);
  });
});
