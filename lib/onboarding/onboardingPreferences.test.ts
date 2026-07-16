import { describe, expect, it } from "vitest";
import {
  defaultOnboardingPreferences,
  mergeOnboardingPatch,
  parseOnboardingPatch,
  parseOnboardingPreferences,
  shouldShowOnboardingChrome,
} from "./onboardingPreferences";

describe("shouldShowOnboardingChrome", () => {
  it("shows for fresh defaults", () => {
    expect(shouldShowOnboardingChrome(defaultOnboardingPreferences())).toBe(true);
  });

  it("hides when dismissed even if steps incomplete", () => {
    expect(
      shouldShowOnboardingChrome(
        mergeOnboardingPatch(defaultOnboardingPreferences(), { dismissed: true })
      )
    ).toBe(false);
  });

  it("hides when both steps done", () => {
    expect(
      shouldShowOnboardingChrome(
        mergeOnboardingPatch(defaultOnboardingPreferences(), {
          generateDone: true,
          designModeDone: true,
        })
      )
    ).toBe(false);
  });

  it("still shows after generate only", () => {
    expect(
      shouldShowOnboardingChrome(
        mergeOnboardingPatch(defaultOnboardingPreferences(), { generateDone: true })
      )
    ).toBe(true);
  });
});

describe("mergeOnboardingPatch", () => {
  it("is idempotent when setting designModeDone twice", () => {
    const once = mergeOnboardingPatch(defaultOnboardingPreferences(), {
      generateDone: true,
      designModeDone: true,
    });
    const twice = mergeOnboardingPatch(once, { designModeDone: true });
    expect(twice).toEqual(once);
  });

  it("does not clear sibling flags when patching one key", () => {
    const current = mergeOnboardingPatch(defaultOnboardingPreferences(), {
      generateDone: true,
    });
    const next = mergeOnboardingPatch(current, { designModeDone: true });
    expect(next.generateDone).toBe(true);
    expect(next.designModeDone).toBe(true);
    expect(next.dismissed).toBe(false);
  });
});

describe("parseOnboardingPreferences", () => {
  it("returns defaults for null/garbage", () => {
    expect(parseOnboardingPreferences(null)).toEqual(defaultOnboardingPreferences());
    expect(parseOnboardingPreferences("x")).toEqual(defaultOnboardingPreferences());
  });

  it("fills missing keys from partial JSON", () => {
    expect(parseOnboardingPreferences({ generateDone: true })).toEqual({
      ...defaultOnboardingPreferences(),
      generateDone: true,
    });
  });
});

describe("parseOnboardingPatch", () => {
  it("accepts known boolean keys only", () => {
    expect(parseOnboardingPatch({ dismissed: true, extra: 1 })).toEqual({ dismissed: true });
  });

  it("rejects non-boolean values", () => {
    expect(parseOnboardingPatch({ dismissed: "yes" })).toBeNull();
  });

  it("rejects empty object", () => {
    expect(parseOnboardingPatch({})).toBeNull();
  });
});

describe("isOnboardingResetRequest", () => {
  it("detects reset: true", async () => {
    const { isOnboardingResetRequest } = await import("./onboardingPreferences");
    expect(isOnboardingResetRequest({ reset: true })).toBe(true);
    expect(isOnboardingResetRequest({ reset: false })).toBe(false);
    expect(isOnboardingResetRequest({ dismissed: true })).toBe(false);
  });
});
