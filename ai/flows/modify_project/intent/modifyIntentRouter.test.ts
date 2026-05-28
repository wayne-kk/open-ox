import { describe, expect, it } from "vitest";
import { parseModifyIntentRouterPayload } from "./modifyIntentRouter";

describe("parseModifyIntentRouterPayload", () => {
  it("normalizes categories, scope, preloadPaths, and assistantMessage", () => {
    expect(
      parseModifyIntentRouterPayload({
        category: "read_only",
        assistantMessage: " Explain Hero ",
        preloadPaths: ["app/page.tsx"],
      })
    ).toEqual({
      category: "read_only",
      scope: "narrow",
      preloadPaths: ["app/page.tsx"],
      assistantMessage: "Explain Hero",
    });
  });

  it("parses code_change scope and preloadPaths", () => {
    expect(
      parseModifyIntentRouterPayload({
        category: "code_change",
        scope: "style",
        preloadPaths: ["./app/globals.css", "components/Hero.tsx"],
        assistantMessage: "",
      })
    ).toEqual({
      category: "code_change",
      scope: "style",
      preloadPaths: ["app/globals.css", "components/Hero.tsx"],
      assistantMessage: "",
    });
  });

  it("parses plan_only with preloadPaths", () => {
    expect(
      parseModifyIntentRouterPayload({
        category: "plan_only",
        preloadPaths: ["app/globals.css"],
        assistantMessage: "User wants dark theme plan",
      })
    ).toEqual({
      category: "plan_only",
      scope: "narrow",
      preloadPaths: ["app/globals.css"],
      assistantMessage: "User wants dark theme plan",
    });
  });

  it("defaults invalid category to read_only", () => {
    expect(parseModifyIntentRouterPayload({ category: "chat", assistantMessage: "" })).toEqual({
      category: "read_only",
      scope: "narrow",
      preloadPaths: [],
      assistantMessage: "",
    });
  });
});
