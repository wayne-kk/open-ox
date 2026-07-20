import { describe, expect, it } from "vitest";
import { resolveStartBuildAction, WORKSPACE_PROMPT_HASH } from "./startBuild";

describe("resolveStartBuildAction", () => {
  it("focuses when already on dashboard with the composer visible", () => {
    expect(
      resolveStartBuildAction({ pathname: "/dashboard", onTrashed: false })
    ).toEqual({ type: "focus" });
  });

  it("navigates off recycle bin so the composer can mount", () => {
    expect(
      resolveStartBuildAction({ pathname: "/dashboard", onTrashed: true })
    ).toEqual({
      type: "navigate",
      href: `/dashboard#${WORKSPACE_PROMPT_HASH}`,
    });
  });

  it("navigates to dashboard from other app routes", () => {
    expect(
      resolveStartBuildAction({ pathname: "/community", onTrashed: false })
    ).toEqual({
      type: "navigate",
      href: `/dashboard#${WORKSPACE_PROMPT_HASH}`,
    });
  });
});
