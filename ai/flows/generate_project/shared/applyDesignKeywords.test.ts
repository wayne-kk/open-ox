import { describe, expect, it } from "vitest";
import type { ProjectBlueprint } from "../types";
import {
  applyDesignKeywordsBeforePlan,
  isSaasDefaultKeywordPack,
  SAAS_DEFAULT_KEYWORD_PACK,
} from "./applyDesignKeywords";

function stubBlueprint(keywords: string[] = []): ProjectBlueprint {
  return {
    brief: {
      projectTitle: "Demo",
      projectDescription: "Desc",
      language: "en",
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
    experience: {
      designIntent: {
        mood: [],
        colorDirection: "",
        style: "",
        keywords,
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
  };
}

describe("applyDesignKeywordsBeforePlan", () => {
  it("prefers confirmed keywords over inferred", () => {
    const out = applyDesignKeywordsBeforePlan(stubBlueprint(), {
      confirmedKeywords: ["paper", "gallery"],
      inferredKeywords: ["museum", "editorial"],
    });
    expect(out.experience.designIntent.keywords).toEqual(["paper", "gallery"]);
    expect(isSaasDefaultKeywordPack(out.experience.designIntent.keywords)).toBe(false);
  });

  it("uses inferred keywords when confirmed empty", () => {
    const out = applyDesignKeywordsBeforePlan(stubBlueprint(), {
      confirmedKeywords: [],
      inferredKeywords: ["tactile", "museum", "paper"],
    });
    expect(out.experience.designIntent.keywords).toEqual(["tactile", "museum", "paper"]);
    expect(isSaasDefaultKeywordPack(out.experience.designIntent.keywords)).toBe(false);
  });

  it("keeps existing when neither confirmed nor inferred", () => {
    const out = applyDesignKeywordsBeforePlan(stubBlueprint(["editorial"]), {
      confirmedKeywords: [],
      inferredKeywords: [],
    });
    expect(out.experience.designIntent.keywords).toEqual(["editorial"]);
  });

  it("does not inject the SaaS default pack", () => {
    const out = applyDesignKeywordsBeforePlan(stubBlueprint(), {
      confirmedKeywords: [],
      inferredKeywords: [],
    });
    expect(out.experience.designIntent.keywords).toEqual([]);
    expect([...SAAS_DEFAULT_KEYWORD_PACK]).not.toEqual(out.experience.designIntent.keywords);
  });
});

describe("isSaasDefaultKeywordPack", () => {
  it("detects the five-word SaaS pack", () => {
    expect(isSaasDefaultKeywordPack([...SAAS_DEFAULT_KEYWORD_PACK])).toBe(true);
    expect(isSaasDefaultKeywordPack(["museum", "paper"])).toBe(false);
  });
});
