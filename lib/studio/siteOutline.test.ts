import { describe, expect, it } from "vitest";
import {
  createEmptySiteOutline,
  outlineToSectionSpecs,
  parseSiteOutline,
  sectionFileNameForModule,
} from "./siteOutline";

describe("siteOutline", () => {
  it("parses a valid outline", () => {
    const outline = parseSiteOutline({
      pageSlug: "home",
      pageGoal: "Book demos",
      modules: [
        { id: "a", type: "hero", title: "Hero", intent: "Hook" },
        { type: "pricing", title: "Plans" },
      ],
    });
    expect(outline).not.toBeNull();
    expect(outline!.modules).toHaveLength(2);
    expect(outline!.modules[1]!.type).toBe("pricing");
    expect(outline!.modules[1]!.id).toBeTruthy();
  });

  it("rejects empty modules", () => {
    expect(parseSiteOutline({ pageGoal: "x", modules: [] })).toBeNull();
  });

  it("maps modules to SectionSpec with unique file names", () => {
    const outline = createEmptySiteOutline();
    outline.modules.push({
      id: "f1",
      type: "features",
      title: "Features",
    });
    const specs = outlineToSectionSpecs(outline);
    expect(specs).toHaveLength(2);
    expect(specs[0]!.fileName).toBe("Hero.tsx");
    expect(specs[1]!.fileName).toBe("Features2.tsx");
    expect(new Set(specs.map((s) => s.fileName)).size).toBe(2);
  });

  it("builds section file names", () => {
    expect(sectionFileNameForModule("logo_cloud", 0)).toBe("LogoCloud.tsx");
    expect(sectionFileNameForModule("faq", 2)).toBe("Faq3.tsx");
  });
});
