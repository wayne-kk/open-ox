import { describe, expect, it } from "vitest";
import { resolveModifyProfile, toolNamesForProfile } from "./modifyProfile";

describe("resolveModifyProfile", () => {
  it("read_only profile is non-editing", () => {
    const profile = resolveModifyProfile({
      category: "read_only",
      scope: "narrow",
      preloadPaths: [],
      assistantMessage: "",
    });
    expect(profile.allowEdits).toBe(false);
    expect(profile.verificationMode).toBe("none");
    expect(toolNamesForProfile(profile)).toEqual([
      "read_file",
      "search_code",
      "list_dir",
      "think",
      "spawn_subagent",
    ]);
  });

  it("code_change style profile disables write_file", () => {
    const profile = resolveModifyProfile({
      category: "code_change",
      scope: "style",
      preloadPaths: [],
      assistantMessage: "",
    });
    expect(profile.allowEdits).toBe(true);
    expect(profile.allowWriteFile).toBe(false);
    expect(profile.verificationMode).toBe("tsc_only");
  });

  it("edit profiles include spawn_subagent", () => {
    const profile = resolveModifyProfile({
      category: "code_change",
      scope: "narrow",
      preloadPaths: [],
      assistantMessage: "",
    });
    expect(toolNamesForProfile(profile)).toContain("spawn_subagent");
  });
});
