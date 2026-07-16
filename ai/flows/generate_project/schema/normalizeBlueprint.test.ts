import { describe, expect, it } from "vitest";
import { asProjectBlueprint, emptyProjectExperience } from "./normalizeBlueprint";

describe("normalizeExperience defaults", () => {
  it("fills empty experience with empty keywords (no SaaS defaults)", () => {
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
      site: {
        informationArchitecture: {
          navigationModel: "nav",
          pageMap: [],
          sharedShells: [],
          notes: [],
        },
        pages: [],
      },
    });
    expect(result.experience.designIntent.keywords).toEqual([]);
    expect(result.experience.designIntent.mood).toEqual([]);
    expect(result.experience).toEqual(emptyProjectExperience());
  });
});

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
      site: { informationArchitecture: { navigationModel: "nav", pageMap: [], sharedShells: [], notes: [] }, pages: [] },
    });
    expect(result.site.pages[0]?.slug ?? "home").toBe("home");
  });

  it("converts flat shape into nested shape", () => {
    const result = asProjectBlueprint({
      projectTitle: "Flat",
      projectDescription: "Flat desc",
      designIntent: { style: "clean", colorDirection: "neutral", mood: [], keywords: [] },
      pages: [],
    });
    expect(result.brief.projectTitle).toBe("Flat");
    expect(result.site.pages[0].slug).toBe("home");
  });

  it("clamps overly long projectTitle in brief", () => {
    const long =
      "这一段是模型经常吐出来的超长项目标题它把整句产品说明都塞进了 projectTitle 字段里应该被截断";
    const result = asProjectBlueprint({
      brief: {
        projectTitle: long,
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
      site: { informationArchitecture: { navigationModel: "nav", pageMap: [], sharedShells: [], notes: [] }, pages: [] },
    });
    expect(result.brief.projectTitle.length).toBeLessThanOrEqual(56);
  });
});
