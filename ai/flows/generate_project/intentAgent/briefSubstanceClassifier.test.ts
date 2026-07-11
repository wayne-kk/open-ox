import { describe, expect, it } from "vitest";
import {
  briefSubstanceHeuristicLengths,
  isConfirmHeavyTail,
  isProceduralConfirmTail,
  parseBriefSubstanceClassification,
  tryBriefSubstanceHeuristicFastPath,
} from "./briefSubstanceClassifier";

describe("parseBriefSubstanceClassification", () => {
  it("requires strict true for booleans", () => {
    expect(
      parseBriefSubstanceClassification({
        mergedBriefSubstantive: true,
        tailSubstantive: "yes",
        bootstrapSubstantive: 1,
      })
    ).toEqual({
      mergedBriefFieldSubstantive: true,
      tailSubstantive: false,
      bootstrapSubstantive: false,
    });
  });

  it("parses all true", () => {
    expect(
      parseBriefSubstanceClassification({
        mergedBriefSubstantive: true,
        tailSubstantive: true,
        bootstrapSubstantive: true,
      })
    ).toEqual({
      mergedBriefFieldSubstantive: true,
      tailSubstantive: true,
      bootstrapSubstantive: true,
    });
  });
});

describe("briefSubstanceHeuristicLengths", () => {
  it("does not flag short procedural tail as substantive", () => {
    expect(
      briefSubstanceHeuristicLengths({
        mergedBriefRaw: "",
        tailUserMessage: "你自己决定就好 开始生成吧",
        bootstrapUserPrompt: "a".repeat(50),
      })
    ).toEqual({
      mergedBriefFieldSubstantive: false,
      tailSubstantive: false,
      bootstrapSubstantive: true,
    });
  });

  it("flags merged brief at fallback length", () => {
    expect(
      briefSubstanceHeuristicLengths({
        mergedBriefRaw: "x".repeat(24),
        tailUserMessage: "",
        bootstrapUserPrompt: "",
      })
    ).toEqual({
      mergedBriefFieldSubstantive: true,
      tailSubstantive: false,
      bootstrapSubstantive: false,
    });
  });
});

describe("confirm-tail heuristics", () => {
  it("detects pure confirm phrases", () => {
    expect(isProceduralConfirmTail("开始生成吧")).toBe(true);
    expect(isProceduralConfirmTail("就这样")).toBe(true);
    expect(isProceduralConfirmTail("ok")).toBe(true);
    expect(isProceduralConfirmTail("搭建一个树洞分享平台")).toBe(false);
  });

  it("detects confirm-heavy brand+go tails", () => {
    expect(isConfirmHeavyTail("品牌名叫“心语树洞”，开始生成吧")).toBe(true);
    expect(isConfirmHeavyTail("就这样，开始生成吧")).toBe(true);
    expect(isConfirmHeavyTail("我还想加会员体系和积分商城，并且需要后台管理")).toBe(false);
  });

  it("skips LLM for brand confirm when merged brief is ready", () => {
    const brief = "单页树洞分享平台，面向年轻人倾诉心情。".repeat(2);
    expect(
      tryBriefSubstanceHeuristicFastPath({
        mergedBriefRaw: brief,
        tailUserMessage: "品牌名叫“心语树洞”，开始生成吧",
        bootstrapUserPrompt: "搭建一个树洞分享平台",
      })
    ).toEqual({
      mergedBriefFieldSubstantive: true,
      tailSubstantive: false,
      bootstrapSubstantive: false,
    });
  });

  it("skips LLM for pure confirm with substantive bootstrap", () => {
    expect(
      tryBriefSubstanceHeuristicFastPath({
        mergedBriefRaw: "",
        tailUserMessage: "开始生成吧",
        bootstrapUserPrompt: "a".repeat(50),
      })
    ).toEqual({
      mergedBriefFieldSubstantive: false,
      tailSubstantive: false,
      bootstrapSubstantive: true,
    });
  });
});
