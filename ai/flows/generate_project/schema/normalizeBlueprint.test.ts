import { describe, expect, it } from "vitest";
import { asProjectBlueprint } from "./normalizeBlueprint";

describe("asProjectBlueprint", () => {
  it("accepts nested ProjectBlueprint shape", () => {
    const result = asProjectBlueprint({
      brief: {
        projectTitle: "Demo",
        projectDescription: "Desc",
        roles: [],
        taskLoops: [],
        capabilities: [],
        productScope: {
          productType: "site",
          mvpDefinition: "mvp",
          coreOutcome: "outcome",
          businessGoal: "goal",
          audienceSummary: "audience",
          inScope: ["x"],
          outOfScope: [],
        },
      },
      experience: { designIntent: { style: "minimal", colorDirection: "light", mood: [], keywords: [] } },
      site: { informationArchitecture: { navigationModel: "nav", pageMap: [], sharedShells: [], notes: [] }, layoutSections: [], pages: [] },
    });
    expect(result.site.pages[0]?.slug ?? "home").toBe("home");
  });

  it("converts flat shape into nested shape", () => {
    const result = asProjectBlueprint({
      projectTitle: "Flat",
      projectDescription: "Flat desc",
      designIntent: { style: "clean", colorDirection: "neutral", mood: [], keywords: [] },
      layoutSections: [],
      pages: [],
    });
    expect(result.brief.projectTitle).toBe("Flat");
    expect(result.site.pages[0].slug).toBe("home");
  });
});
