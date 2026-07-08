import { describe, expect, it } from "vitest";
import { buildModifyDraftFromVisualEdits } from "./buildModifyDraftFromVisualEdits";
import type { VisualEdit } from "./protocol";

describe("buildModifyDraftFromVisualEdits", () => {
  it("returns empty string for no edits", () => {
    expect(buildModifyDraftFromVisualEdits([])).toBe("");
  });

  it("builds grouped draft with selector hints and property changes", () => {
    const edits: VisualEdit[] = [
      {
        kind: "style",
        selectorHint: "main > section.hero > h1.title",
        elementLabel: "h1.title",
        property: "color",
        before: "rgb(255, 255, 255)",
        after: "#ff5500",
      },
      {
        kind: "style",
        selectorHint: "main > section.hero > h1.title",
        elementLabel: "h1.title",
        property: "fontSize",
        before: "48px",
        after: "52px",
      },
    ];

    const draft = buildModifyDraftFromVisualEdits(edits);
    expect(draft).toContain("Studio Design Mode");
    expect(draft).toContain("main > section.hero > h1.title");
    expect(draft).toContain("`rgb(255, 255, 255)` → `#ff5500`");
    expect(draft).toContain("`48px` → `52px`");
    expect(draft).toContain("do not change layout structure");
  });

  it("includes text copy edits", () => {
    const edits: VisualEdit[] = [
      {
        kind: "text",
        selectorHint: "nav > a.link",
        elementLabel: "a.link",
        before: "精选曲目",
        after: "热门曲目",
      },
    ];

    const draft = buildModifyDraftFromVisualEdits(edits);
    expect(draft).toContain("copy/text: `精选曲目` → `热门曲目`");
  });

  it("separates edits for different elements", () => {
    const edits: VisualEdit[] = [
      {
        kind: "style",
        selectorHint: "button.cta",
        elementLabel: "button.cta",
        property: "borderRadius",
        before: "4px",
        after: "12px",
      },
      {
        kind: "style",
        selectorHint: "footer",
        elementLabel: "footer",
        property: "padding",
        before: "16px",
        after: "24px",
      },
    ];

    const draft = buildModifyDraftFromVisualEdits(edits);
    expect(draft).toContain("1. Element: button.cta");
    expect(draft).toContain("2. Element: footer");
  });
});
