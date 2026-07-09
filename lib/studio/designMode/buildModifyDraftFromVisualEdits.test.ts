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

  it("includes full className edits", () => {
    const edits: VisualEdit[] = [
      {
        kind: "className",
        selectorHint: "h1.title",
        elementLabel: "h1.title",
        before: "text-4xl text-white",
        after: "text-5xl font-bold text-[#f7931a]",
      },
    ];

    const draft = buildModifyDraftFromVisualEdits(edits);
    expect(draft).toContain("className: `text-4xl text-white` → `text-5xl font-bold text-[#f7931a]`");
  });

  it("includes source coordinates in the draft when present", () => {
    const edits: VisualEdit[] = [
      {
        kind: "style",
        source: {
          version: 1,
          file: "components/sections/Hero.tsx",
          line: 12,
          column: 4,
          tag: "h1",
          textKind: "static",
          classKind: "static",
        },
        selectorHint: "h1.title",
        elementLabel: "h1.title",
        property: "color",
        before: "#fff",
        after: "#f00",
      },
    ];
    const draft = buildModifyDraftFromVisualEdits(edits);
    expect(draft).toContain("components/sections/Hero.tsx:12:4");
  });
});
