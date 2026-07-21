import { describe, expect, it } from "vitest";
import { validateDirectionLockGenerationCommit } from "./directionLockCommit";

describe("validateDirectionLockGenerationCommit", () => {
  it("requires the Studio confirmation path while direction lock is enabled", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "intent_agent",
        hasConfirmedSiteOutline: false,
      })
    ).toMatchObject({ ok: false, code: "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION" });
  });

  it("requires a valid outline from the Studio confirmation path", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "direction_lock_ui",
        hasConfirmedSiteOutline: false,
      })
    ).toMatchObject({ ok: false, code: "CONFIRMED_SITE_OUTLINE_REQUIRED" });
  });

  it("allows the confirmed Studio path and the legacy flag-off path", () => {
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: true,
        source: "direction_lock_ui",
        hasConfirmedSiteOutline: true,
      })
    ).toEqual({ ok: true });
    expect(
      validateDirectionLockGenerationCommit({
        directionLockEnabled: false,
        source: "intent_agent",
        hasConfirmedSiteOutline: false,
      })
    ).toEqual({ ok: true });
  });
});
