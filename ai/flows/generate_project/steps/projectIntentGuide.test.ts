import { describe, expect, it } from "vitest";
import {
  buildEffectiveUserPromptForGeneration,
  parseProjectIntentGuidePayload,
} from "./projectIntentGuide";

describe("parseProjectIntentGuidePayload", () => {
  it("defaults invalid outcome to guide_user", () => {
    const r = parseProjectIntentGuidePayload({
      outcome: "nope",
      phase: "choices",
      assistantMessage: "hello",
      suggestedReplies: [],
      choiceOptions: [],
      buildPromptAppendix: "should be ignored",
    });
    expect(r.outcome).toBe("guide_user");
    expect(r.buildPromptAppendix).toBeNull();
    expect(r.phase).toBe("choices");
  });

  it("forces build_ready and keeps appendix for continue_build", () => {
    const r = parseProjectIntentGuidePayload({
      outcome: "continue_build",
      phase: "clarify",
      assistantMessage: "ok",
      suggestedReplies: [],
      choiceOptions: [],
      buildPromptAppendix: "  MVP: landing  ",
    });
    expect(r.outcome).toBe("continue_build");
    expect(r.phase).toBe("build_ready");
    expect(r.buildPromptAppendix).toBe("MVP: landing");
  });

  it("parses choice options with hint", () => {
    const r = parseProjectIntentGuidePayload({
      outcome: "guide_user",
      phase: "choices",
      assistantMessage: "pick one",
      suggestedReplies: ["A"],
      choiceOptions: [{ id: "narrative", label: "Long scroll", hint: "marketing" }],
      buildPromptAppendix: null,
    });
    expect(r.choiceOptions).toEqual([{ id: "narrative", label: "Long scroll", hint: "marketing" }]);
  });
});

describe("buildEffectiveUserPromptForGeneration", () => {
  it("returns base when appendix empty", () => {
    expect(buildEffectiveUserPromptForGeneration(" hi ", null)).toBe("hi");
  });

  it("concatenates when appendix provided", () => {
    expect(buildEffectiveUserPromptForGeneration("u", "x")).toContain("## Original user message");
    expect(buildEffectiveUserPromptForGeneration("u", "x")).toContain("u");
    expect(buildEffectiveUserPromptForGeneration("u", "x")).toContain("x");
  });
});
