import { describe, expect, it } from "vitest";
import {
  applyContinuationRoutingOverrides,
  detectContinuationReply,
  inferContinuationCategory,
  mergeContinuationInstruction,
  shouldBlockConversationShortCircuit,
} from "./modifyContinuation";

describe("modifyContinuation", () => {
  const awaitingHistory = [
    {
      instruction: "把动画速度调快一点",
      summary: "速度需要调整到多少？ Files: ",
      intentCategory: "code_change" as const,
    },
  ];

  it("detects short numeric follow-up after a clarifying question", () => {
    expect(detectContinuationReply("1", awaitingHistory)).toBe(true);
    expect(detectContinuationReply("1.5x", awaitingHistory)).toBe(true);
  });

  it("does not treat meta greetings as continuation", () => {
    expect(detectContinuationReply("你好", awaitingHistory)).toBe(false);
  });

  it("merges continuation into a single instruction block", () => {
    const merged = mergeContinuationInstruction("1", awaitingHistory);
    expect(merged).toContain("用户最初请求：把动画速度调快一点");
    expect(merged).toContain("速度需要调整到多少");
    expect(merged).toContain("用户本轮补充：1");
  });

  it("inherits prior intent category for continuation", () => {
    expect(inferContinuationCategory(awaitingHistory)).toBe("code_change");
  });

  it("overrides conversation routing when continuation is detected", () => {
    const routed = applyContinuationRoutingOverrides(
      {
        category: "conversation",
        scope: "narrow",
        preloadPaths: [],
        assistantMessage: "您好！请问有什么我可以帮您的？",
      },
      {
        isContinuation: true,
        recentHistory: awaitingHistory,
        originalInstruction: "1",
      }
    );
    expect(routed.category).toBe("code_change");
    expect(routed.assistantMessage).toBe("");
  });

  it("blocks conversation short-circuit when modify history exists", () => {
    expect(shouldBlockConversationShortCircuit("1", awaitingHistory)).toBe(true);
    expect(shouldBlockConversationShortCircuit("你好", awaitingHistory)).toBe(false);
  });

  it("re-routes ambiguous short replies away from conversation when history exists", () => {
    const routed = applyContinuationRoutingOverrides(
      {
        category: "conversation",
        scope: "narrow",
        preloadPaths: [],
        assistantMessage: "您好！",
      },
      {
        isContinuation: false,
        recentHistory: awaitingHistory,
        originalInstruction: "随便看看",
      }
    );
    expect(routed.category).toBe("code_change");
  });
});
