import { describe, expect, it } from "vitest";
import { deploymentFreshness } from "./projectVersionState";

describe("deploymentFreshness", () => {
  it("reports never deployed without a production URL", () => {
    expect(
      deploymentFreshness({
        productionUrl: null,
        currentVersionId: "v2",
        deployedVersionId: null,
      })
    ).toBe("never_deployed");
  });

  it("compares immutable version ids when both are known", () => {
    expect(
      deploymentFreshness({
        productionUrl: "https://example.com",
        currentVersionId: "v2",
        deployedVersionId: "v1",
      })
    ).toBe("updates_available");
    expect(
      deploymentFreshness({
        productionUrl: "https://example.com",
        currentVersionId: "v2",
        deployedVersionId: "v2",
      })
    ).toBe("up_to_date");
  });

  it("falls back to source fingerprints for legacy deployments", () => {
    expect(
      deploymentFreshness({
        productionUrl: "https://example.com",
        currentVersionId: "v2",
        deployedVersionId: null,
        currentSourceFingerprint: "new",
        deployedSourceFingerprint: "old",
      })
    ).toBe("updates_available");
  });

  it("detects working-copy edits before a new version row exists", () => {
    expect(
      deploymentFreshness({
        productionUrl: "https://example.com",
        currentVersionId: "v1",
        deployedVersionId: "v1",
        currentSourceFingerprint: "working-copy",
        deployedSourceFingerprint: "v1-source",
      })
    ).toBe("updates_available");
  });

  it("offers an update when a legacy deployment predates version tracking", () => {
    expect(
      deploymentFreshness({
        productionUrl: "https://example.com",
        currentVersionId: "v1",
        deployedVersionId: null,
      })
    ).toBe("updates_available");
  });
});
