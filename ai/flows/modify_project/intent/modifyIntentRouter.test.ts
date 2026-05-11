import { describe, expect, it } from "vitest";
import { parseModifyIntentRouterPayload } from "./modifyIntentRouter";

describe("parseModifyIntentRouterPayload", () => {
  it("normalizes categories and assistantMessage", () => {
    expect(
      parseModifyIntentRouterPayload({
        category: "read_only",
        assistantMessage: " Explain Hero ",
      })
    ).toEqual({ category: "read_only", assistantMessage: "Explain Hero" });
  });

  it("defaults invalid category to code_change", () => {
    expect(parseModifyIntentRouterPayload({ category: "chat", assistantMessage: "" })).toEqual({
      category: "code_change",
      assistantMessage: "",
    });
  });
});
