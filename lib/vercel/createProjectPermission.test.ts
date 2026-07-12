import { describe, expect, it } from "vitest";
import {
  formatVercelCreateProjectError,
  isVercelCreateProjectPermissionError,
  teamIdCandidatesForCreateWithFallback,
  VERCEL_CREATE_PROJECT_PERMISSION_HINT,
} from "./createProjectPermission";

describe("isVercelCreateProjectPermissionError", () => {
  it("matches the exact Vercel API message from deploy failures", () => {
    expect(
      isVercelCreateProjectPermissionError(
        "Vercel API 403: You don't have permission to create the project."
      )
    ).toBe(true);
  });

  it("ignores unrelated 403s", () => {
    expect(isVercelCreateProjectPermissionError("Vercel API 403: forbidden")).toBe(false);
  });
});

describe("teamIdCandidatesForCreateWithFallback", () => {
  it("prefers installation team over a drifted stored team", () => {
    expect(teamIdCandidatesForCreateWithFallback("team_wrong", "team_install")).toEqual([
      "team_install",
      "team_wrong",
      null,
    ]);
  });

  it("still tries null when only stored team exists", () => {
    expect(teamIdCandidatesForCreateWithFallback("team_a", null)).toEqual(["team_a", null]);
  });

  it("dedupes when stored equals installation", () => {
    expect(teamIdCandidatesForCreateWithFallback("team_a", "team_a")).toEqual(["team_a", null]);
  });
});

describe("formatVercelCreateProjectError", () => {
  it("replaces create-permission 403 with actionable Chinese guidance", () => {
    expect(
      formatVercelCreateProjectError(
        "Vercel API 403: You don't have permission to create the project."
      )
    ).toBe(VERCEL_CREATE_PROJECT_PERMISSION_HINT);
  });
});
