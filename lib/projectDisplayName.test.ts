import { describe, expect, it } from "vitest";

import { clampProjectListName, PROJECT_LIST_NAME_MAX_CHARS } from "./projectDisplayName";

describe("clampProjectListName", () => {
  it("returns short strings unchanged after trim", () => {
    expect(clampProjectListName("  WAR ROOM  ")).toBe("WAR ROOM");
  });

  it("clips long titles near max length preferring word break", () => {
    const long =
      "This is an unnecessarily long generated product title that should not appear in full in the list view";
    const out = clampProjectListName(long);
    expect(out.length).toBeLessThanOrEqual(PROJECT_LIST_NAME_MAX_CHARS);
    expect(out.endsWith(" ")).toBe(false);
  });
});
