import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectBlueprint } from "../types";

const { callLLMWithMeta, writeSiteFile } = vi.hoisted(() => ({
  callLLMWithMeta: vi.fn(),
  writeSiteFile: vi.fn(),
}));

vi.mock("../shared/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/llm")>()),
  callLLMWithMeta,
}));

vi.mock("../shared/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/files")>()),
  writeSiteFile,
}));

import { stepPlanProject } from "./planProject";

const blueprint: ProjectBlueprint = {
  brief: {
    projectTitle: "Acme",
    projectDescription: "A small company site.",
    language: "en",
    productScope: {
      productType: "company website",
      mvpDefinition: "Explain the company and its product.",
      coreOutcome: "Visitors can evaluate Acme.",
      businessGoal: "Generate qualified leads.",
      audienceSummary: "Prospective customers.",
      inScope: ["Home", "About"],
      outOfScope: ["Authenticated application"],
    },
    roles: [],
    taskLoops: [],
    capabilities: [],
  },
  experience: {
    designIntent: {
      style: "editorial",
      colorDirection: "light",
      mood: [],
      keywords: [],
    },
  },
  site: {
    informationArchitecture: {
      navigationModel: "Top navigation between routes.",
      pageMap: [],
      sharedShells: ["site-header", "site-footer"],
      notes: [],
      chromeForm: "top-nav+footer",
      sharedContracts: [],
    },
    pages: [
      {
        title: "Home",
        slug: "home",
        description: "Overview",
        journeyStage: "discover",
        primaryRoleIds: [],
        supportingCapabilityIds: [],
        sections: [],
      },
      {
        title: "About",
        slug: "about",
        description: "Company story",
        journeyStage: "evaluate",
        primaryRoleIds: [],
        supportingCapabilityIds: [],
        sections: [],
      },
    ],
  },
};

function pagePlan(slug: string, title: string) {
  return {
    title,
    slug,
    description: `Model-authored ${slug}`,
    journeyStage: "model-authored",
    primaryRoleIds: ["model-role"],
    supportingCapabilityIds: ["model-capability"],
    sections: [],
    pageDesignPlan: {
      pageGoal: `Goal for ${slug}`,
      narrativeArc: `Arc for ${slug}`,
      layoutStrategy: `Layout for ${slug}`,
      hierarchy: ["Primary"],
      constraints: ["Keep it focused"],
    },
  };
}

describe("stepPlanProject", () => {
  beforeEach(() => {
    callLLMWithMeta.mockReset();
    writeSiteFile.mockReset();
  });

  it("keeps the canonical route order and page metadata from the analyzed blueprint", async () => {
    callLLMWithMeta.mockResolvedValue({
      content: JSON.stringify({
        chromeForm: "top-nav+footer",
        sharedContracts: [],
        pages: [
          pagePlan("about", "Changed about"),
          pagePlan("home", "Changed home"),
        ],
      }),
      model: "test-model",
    });

    const result = await stepPlanProject(blueprint);

    expect(
      result.blueprint.site.pages.map(
        ({ slug, title, description, journeyStage }) => ({
          slug,
          title,
          description,
          journeyStage,
        }),
      ),
    ).toEqual([
      {
        slug: "home",
        title: "Home",
        description: "Overview",
        journeyStage: "discover",
      },
      {
        slug: "about",
        title: "About",
        description: "Company story",
        journeyStage: "evaluate",
      },
    ]);
    const writtenPlan = JSON.parse(writeSiteFile.mock.calls[0]?.[1] as string);
    expect(
      writtenPlan.pages.map((page: { slug: string; title: string }) => ({
        slug: page.slug,
        title: page.title,
      })),
    ).toEqual([
      { slug: "home", title: "Home" },
      { slug: "about", title: "About" },
    ]);
  });

  it("rejects a plan that drops a canonical route", async () => {
    callLLMWithMeta.mockResolvedValue({
      content: JSON.stringify({
        chromeForm: "top-nav+footer",
        sharedContracts: [],
        pages: [pagePlan("home", "Home")],
      }),
      model: "test-model",
    });

    await expect(stepPlanProject(blueprint)).rejects.toThrow(
      "route count changed from 2 to 1",
    );
  });
});
