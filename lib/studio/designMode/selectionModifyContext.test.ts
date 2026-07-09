import { describe, expect, it } from "vitest";
import { formatSelectionModifyContext } from "./selectionModifyContext";
import type { DesignModeElementPayload } from "./protocol";

const base: DesignModeElementPayload = {
  tagName: "H1",
  id: null,
  className: "text-4xl text-white",
  textPreview: "Hello",
  textContent: "Hello world",
  canEditText: true,
  source: {
    version: 1,
    file: "components/sections/Hero.tsx",
    line: 12,
    column: 4,
    tag: "h1",
    textKind: "static",
    classKind: "static",
  },
  textKind: "static",
  classKind: "static",
  oxId: null,
  selectorHint: "main > section.hero > h1.title",
  styles: {
    color: "#fff",
    fontSize: "36px",
    padding: "0px",
    borderRadius: "0px",
  },
};

describe("formatSelectionModifyContext", () => {
  it("includes source coordinates when present", () => {
    const text = formatSelectionModifyContext(base);
    expect(text).toContain("components/sections/Hero.tsx:12:4");
    expect(text).toContain("Selector hint");
    expect(text).toContain("Hello world");
  });

  it("degrades without source", () => {
    const text = formatSelectionModifyContext({ ...base, source: null });
    expect(text).toContain("no file:line:col");
    expect(text).toContain("`h1`");
  });
});
