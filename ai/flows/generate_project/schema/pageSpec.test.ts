import { describe, expect, it } from "vitest";
import { buildReplicaPageSource } from "../shared/composeReplicaPage";
import { normalizePageSpec, pageSpecSectionsToPlannedSections } from "./pageSpec";

describe("pageSpec", () => {
  it("normalizes sections and rejects empty", () => {
    const spec = normalizePageSpec({
      sections: [
        {
          id: "hero",
          type: "hero-split",
          fileName: "hero",
          intent: "Hero",
          contentHints: "H1 + CTA",
        },
      ],
    });
    expect(spec.sections).toHaveLength(1);
    expect(spec.sections[0].fileName).toBe("hero");
    expect(() => normalizePageSpec({ sections: [] })).toThrow(/at least one section/);
  });

  it("maps to planned sections for replica agents", () => {
    const planned = pageSpecSectionsToPlannedSections(
      normalizePageSpec({
        sections: [
          {
            id: "features",
            type: "feature-grid",
            fileName: "features_grid",
            intent: "Features",
            contentHints: "3 columns",
            layout: { columns: 3 },
          },
        ],
      }).sections
    );
    expect(planned[0].fileName).toBe("features_grid");
    expect(planned[0].contentHints).toContain("3 columns");
  });
});

describe("composeReplicaPage", () => {
  it("builds page.tsx importing section components", () => {
    const { pagePath, source } = buildReplicaPageSource({
      slug: "home",
      sections: [
        {
          type: "hero",
          fileName: "hero",
          intent: "x",
          contentHints: "y",
        },
      ],
    });
    expect(pagePath).toBe("app/page.tsx");
    expect(source).toContain('import HomeHero from "@/components/sections/home_hero"');
    expect(source).toContain("<HomeHero />");
    expect(source).toContain("export default function HomePage");
  });
});
