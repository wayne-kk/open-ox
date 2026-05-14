import { describe, expect, it } from "vitest";
import { parseBriefSubstanceClassification } from "./briefSubstanceClassifier";

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
