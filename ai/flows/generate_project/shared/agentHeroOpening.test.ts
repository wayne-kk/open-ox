import { describe, expect, it } from "vitest";
import type { PlannedPageBlueprint } from "../types";
import {
  buildVirtualHeroSectionForSkillSelection,
  shouldOfferHeroSkillForAgentPage,
} from "./agentHeroOpening";

function stubPage(partial: Partial<PlannedPageBlueprint>): PlannedPageBlueprint {
  const base: PlannedPageBlueprint = {
    title: "Site",
    slug: "home",
    description: "",
    journeyStage: "entry",
    primaryRoleIds: [],
    supportingCapabilityIds: [],
    sections: [],
    pageDesignPlan: {
      pageGoal: "Convert visitors",
      narrativeArc: "Hook then explain",
      layoutStrategy: "Single column scroll",
      hierarchy: ["Headline", "Proof", "CTA"],
      constraints: ["No autoplay audio"],
    },
  };
  return { ...base, ...partial, pageDesignPlan: { ...base.pageDesignPlan, ...partial.pageDesignPlan } };
}

describe("shouldOfferHeroSkillForAgentPage", () => {
  it("returns true for home slug regardless of empty sections", () => {
    expect(shouldOfferHeroSkillForAgentPage(stubPage({ slug: "home", sections: [] }))).toBe(true);
  });

  it("returns false for obvious utility slugs", () => {
    expect(shouldOfferHeroSkillForAgentPage(stubPage({ slug: "settings", journeyStage: "account" }))).toBe(
      false,
    );
  });

  it("returns true when journey stage implies discovery landing", () => {
    expect(
      shouldOfferHeroSkillForAgentPage(stubPage({ slug: "pricing", journeyStage: "awareness" })),
    ).toBe(true);
  });

  it("uses copy signals when slug is neutral", () => {
    expect(
      shouldOfferHeroSkillForAgentPage(
        stubPage({
          slug: "x",
          journeyStage: "consideration",
          pageDesignPlan: {
            ...stubPage({}).pageDesignPlan,
            pageGoal: "Immersive full-viewport cinematic hero above the fold",
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("buildVirtualHeroSectionForSkillSelection", () => {
  it("routes through hero YAML key and summarizes the plan", () => {
    const v = buildVirtualHeroSectionForSkillSelection(stubPage({ slug: "home" }));
    expect(v.type).toBe("hero");
    expect(v.intent).toContain("home");
    expect(v.intent).toContain("Convert visitors");
    expect(v.contentHints).toContain("Layout strategy:");
  });
});
