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

  it("preserves multiple blueprint pages instead of collapsing to a single home", () => {
    const result = asProjectBlueprint({
      brief: {
        projectTitle: "MultiRoute",
        projectDescription: "Desc",
        roles: [],
        taskLoops: [],
        capabilities: [],
        productScope: {
          productType: "marketing website",
          mvpDefinition: "mvp",
          coreOutcome: "outcome",
          businessGoal: "goal",
          audienceSummary: "audience",
          inScope: ["x"],
          outOfScope: [],
        },
      },
      experience: { designIntent: { style: "minimal", colorDirection: "light", mood: [], keywords: [] } },
      site: {
        informationArchitecture: { navigationModel: "top nav", pageMap: [], sharedShells: [], notes: [] },
        pages: [
          {
            title: "Home",
            slug: "home",
            description: "Landing",
            journeyStage: "entry",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
          {
            title: "Pricing",
            slug: "pricing",
            description: "Plans",
            journeyStage: "consider",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
        ],
      },
    });
    expect(result.site.pages).toHaveLength(2);
    expect(result.site.pages.map((p) => p.slug)).toEqual(["home", "pricing"]);
    expect(result.site.informationArchitecture.pageMap).toHaveLength(2);
    expect(result.site.informationArchitecture.navigationModel).not.toContain(
      "in-page anchor links (#section-id), not separate routes"
    );
  });

  it("dedupes duplicate slugs when normalize receives multiple pages", () => {
    const result = asProjectBlueprint({
      brief: {
        projectTitle: "Dedup",
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
      site: {
        informationArchitecture: { navigationModel: "nav", pageMap: [], sharedShells: [], notes: [] },
        pages: [
          {
            title: "Home",
            slug: "home",
            description: "H",
            journeyStage: "entry",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
          {
            title: "One",
            slug: "pricing",
            description: "P1",
            journeyStage: "core",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
          {
            title: "Two",
            slug: "pricing",
            description: "P2",
            journeyStage: "core",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
        ],
      },
    });
    expect(result.site.pages.map((p) => p.slug)).toEqual(["home", "pricing", "pricing-2"]);
  });

  it("assigns slug home to the first route when multi-page blueprint has no home", () => {
    const result = asProjectBlueprint({
      brief: {
        projectTitle: "AppConsole",
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
      site: {
        informationArchitecture: { navigationModel: "sidebar", pageMap: [], sharedShells: [], notes: [] },
        pages: [
          {
            title: "Dashboard",
            slug: "dashboard",
            description: "Main",
            journeyStage: "entry",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
          {
            title: "Settings",
            slug: "settings",
            description: "Prefs",
            journeyStage: "core",
            primaryRoleIds: [],
            supportingCapabilityIds: [],
            sections: [],
          },
        ],
      },
    });
    expect(result.site.pages.map((p) => p.slug)).toEqual(["home", "settings"]);
    expect(result.site.pages[0].title).toBe("Dashboard");
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
