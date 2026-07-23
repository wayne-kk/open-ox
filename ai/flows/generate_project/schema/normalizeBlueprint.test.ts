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
  it("preserves an explicit multi-page route map", () => {
    const result = asProjectBlueprint({
      brief: {
        projectTitle: "Acme",
        projectDescription: "A small company site.",
        roles: [],
        taskLoops: [],
        capabilities: [],
        productScope: {
          productType: "company website",
          mvpDefinition: "Explain the company and its product.",
          coreOutcome: "Visitors can evaluate Acme.",
          businessGoal: "Generate qualified leads.",
          audienceSummary: "Prospective customers.",
          inScope: ["Home", "About", "Documentation"],
          outOfScope: [],
        },
      },
      experience: {
        designIntent: { style: "editorial", colorDirection: "light", mood: [], keywords: [] },
      },
      site: {
        informationArchitecture: {
          navigationModel: "Top navigation between routes.",
          pageMap: [],
          sharedShells: ["site-header", "site-footer"],
          notes: [],
        },
        pages: [
          { title: "Home", slug: "home", description: "Overview" },
          { title: "About", slug: "/about/", description: "Company story" },
          { title: "Getting started", slug: "docs/getting-started", description: "Product documentation" },
        ],
      },
    });

    expect(result.site.pages.map((page) => page.slug)).toEqual([
      "home",
      "about",
      "docs/getting-started",
    ]);
    expect(result.site.informationArchitecture.pageMap.map((page) => page.slug)).toEqual([
      "home",
      "about",
      "docs/getting-started",
    ]);
    expect(result.site.informationArchitecture.navigationModel).toBe("Top navigation between routes.");
  });

  it("keeps every page while making duplicate route slugs unique", () => {
    const result = asProjectBlueprint({
      projectTitle: "Duplicate routes",
      projectDescription: "A multi-page site.",
      designIntent: { style: "", colorDirection: "", mood: [], keywords: [] },
      pages: [
        { title: "Home", slug: "home", description: "Overview" },
        { title: "About", slug: "about", description: "Story" },
        { title: "About the team", slug: "/about/", description: "Team" },
      ],
    });

    expect(result.site.pages.map((page) => page.slug)).toEqual(["home", "about", "about-2"]);
  });

  it("uses a stable fallback for an empty secondary route slug", () => {
    const result = asProjectBlueprint({
      projectTitle: "Fallback routes",
      projectDescription: "A multi-page site.",
      designIntent: { style: "", colorDirection: "", mood: [], keywords: [] },
      pages: [
        { title: "Home", slug: "home", description: "Overview" },
        { title: "Details", slug: "", description: "Details" },
      ],
    });

    expect(result.site.pages.map((page) => page.slug)).toEqual(["home", "page-2"]);
  });

  it("rejects a route roster beyond the generation limit", () => {
    expect(() =>
      asProjectBlueprint({
        projectTitle: "Too many routes",
        projectDescription: "An oversized site.",
        designIntent: { style: "", colorDirection: "", mood: [], keywords: [] },
        pages: Array.from({ length: 9 }, (_, index) => ({
          title: `Page ${index + 1}`,
          slug: index === 0 ? "home" : `page-${index + 1}`,
          description: "Page",
        })),
      })
    ).toThrow("site.pages supports at most 8 routes");
  });

  it("rejects a multi-page roster that omits home instead of dropping a route", () => {
    expect(() =>
      asProjectBlueprint({
        projectTitle: "Missing home",
        projectDescription: "A malformed multi-page site.",
        designIntent: { style: "", colorDirection: "", mood: [], keywords: [] },
        pages: [
          { title: "About", slug: "about", description: "Story" },
          { title: "Contact", slug: "contact", description: "Contact" },
        ],
      })
    ).toThrow("multi-page site must include a home route");
  });

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
