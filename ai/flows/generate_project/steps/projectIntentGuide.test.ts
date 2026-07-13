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
      buildPromptAppendix: "  MVP: landing  ",
    });
    expect(r.outcome).toBe("continue_build");
    expect(r.phase).toBe("build_ready");
    expect(r.buildPromptAppendix).toBe("MVP: landing");
  });

  it("caps suggestedReplies at 3", () => {
    const r = parseProjectIntentGuidePayload({
      outcome: "guide_user",
      phase: "choices",
      assistantMessage: "pick one",
      suggestedReplies: ["品牌展示官网", "可交互工具页", "内容资讯站", "多余第四条"],
      buildPromptAppendix: null,
    });
    expect(r.suggestedReplies).toEqual(["品牌展示官网", "可交互工具页", "内容资讯站"]);
  });

  it("ignores legacy choiceOptions field", () => {
    const r = parseProjectIntentGuidePayload({
      outcome: "guide_user",
      phase: "choices",
      assistantMessage: "pick",
      suggestedReplies: ["品牌展示官网"],
      choiceOptions: [{ id: "narrative", label: "Long scroll", hint: "marketing" }],
      buildPromptAppendix: null,
    });
    expect(r.suggestedReplies).toEqual(["品牌展示官网"]);
    expect("choiceOptions" in r).toBe(false);
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
