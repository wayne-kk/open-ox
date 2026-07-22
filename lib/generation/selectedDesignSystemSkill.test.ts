import { describe, expect, it } from "vitest";
import { parseSelectedDesignSystemSkill } from "./selectedDesignSystemSkill";

describe("parseSelectedDesignSystemSkill", () => {
  it("accepts only a versioned selection", () => {
    expect(
      parseSelectedDesignSystemSkill({ id: " minimal-dark ", version: " 2 " }),
    ).toEqual({ id: "minimal-dark", version: "2" });
  });

  it.each([
    { id: "minimal-dark" },
    { id: "minimal-dark", version: "" },
    { version: "2" },
  ])("rejects incomplete selection %o", (value) => {
    expect(parseSelectedDesignSystemSkill(value)).toBeUndefined();
  });
});
