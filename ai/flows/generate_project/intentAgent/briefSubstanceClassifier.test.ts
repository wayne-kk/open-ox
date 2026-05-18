import { describe, expect, it } from "vitest";
import {
  briefSubstanceHeuristicLengths,
  parseBriefSubstanceClassification,
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
