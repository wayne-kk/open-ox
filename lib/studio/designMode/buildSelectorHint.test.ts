import { describe, expect, it } from "vitest";
import { buildSelectorHintFromElementLike, buildSelectorHintFromSegments } from "./buildSelectorHint";

describe("buildSelectorHint", () => {
  it("joins segments with descendant combinator", () => {
    expect(buildSelectorHintFromSegments(["section.hero", "h1.title"])).toBe("section.hero > h1.title");
  });

  it("caps depth at five segments", () => {
    const segments = ["a", "b", "c", "d", "e", "f"];
    expect(buildSelectorHintFromSegments(segments)).toBe("a > b > c > d > e");
  });

  it("builds hint from element and ancestors", () => {
    const hint = buildSelectorHintFromElementLike(
      { tagName: "BUTTON", className: "cta primary" },
      [{ tagName: "SECTION", className: "hero" }, { tagName: "DIV", className: "wrap" }]
    );
    expect(hint).toContain("section.hero");
    expect(hint).toContain("button.cta.primary");
  });
});
