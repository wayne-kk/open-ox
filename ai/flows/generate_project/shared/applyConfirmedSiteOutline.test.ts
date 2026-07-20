import { describe, expect, it } from "vitest";
import { applyConfirmedSiteOutlineToBlueprint } from "./applyConfirmedSiteOutline";
import type { ProjectBlueprint } from "../types";
import { createEmptySiteOutline } from "@/lib/studio/siteOutline";

function stubBlueprint(sections: ProjectBlueprint["site"]["pages"][0]["sections"] = []): ProjectBlueprint {
  return {
    brief: {
      projectTitle: "Acme",
      projectDescription: "Demo",
      language: "zh",
      productScope: {
        productType: "marketing",
        mvpDefinition: "mvp",
        coreOutcome: "convert",
        businessGoal: "leads",
        audienceSummary: "buyers",
        inScope: [],
        outOfScope: [],
      },
      roles: [],
      taskLoops: [],
      capabilities: [],
    },
    experience: {
      designIntent: {
        mood: [],
        style: "",
        colorDirection: "",
        keywords: [],
      },
    },
    site: {
      informationArchitecture: {
        navigationModel: "single",
        pageMap: [{ slug: "home", title: "Home", purpose: "p", primaryRoleIds: [], supportingCapabilityIds: [], journeyStage: "entry" }],
        sharedShells: [],
        notes: [],
      },
      pages: [
        {
          title: "Home",
          slug: "home",
          description: "Home",
          journeyStage: "entry",
          primaryRoleIds: ["visitor"],
          supportingCapabilityIds: [],
          sections,
        },
      ],
    },
  };
}

describe("applyConfirmedSiteOutlineToBlueprint", () => {
  it("seeds home sections from outline order", () => {
    const outline = createEmptySiteOutline("Book demos");
    outline.modules.push({
      id: "m2",
      type: "pricing",
      title: "Pricing",
      intent: "Plans",
    });
    const next = applyConfirmedSiteOutlineToBlueprint(stubBlueprint([]), outline);
    expect(next.site.pages[0]!.sections).toHaveLength(2);
    expect(next.site.pages[0]!.sections.map((s) => s.type)).toEqual(["hero", "pricing"]);
    expect(next.site.pages[0]!.sections[0]!.fileName).toBe("Hero.tsx");
  });

  it("overwrites prior empty or stale sections", () => {
    const outline = createEmptySiteOutline();
    const next = applyConfirmedSiteOutlineToBlueprint(
      stubBlueprint([
        {
          type: "old",
          intent: "x",
          contentHints: "y",
          fileName: "Old.tsx",
        },
      ]),
      outline
    );
    expect(next.site.pages[0]!.sections).toHaveLength(1);
    expect(next.site.pages[0]!.sections[0]!.type).toBe("hero");
  });
});
