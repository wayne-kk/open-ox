import { describe, expect, it } from "vitest";
import {
  extractLastAssistantMessage,
  formatModifySummaryFallback,
} from "./completionSummary";

describe("completionSummary", () => {
  it("extracts the last non-empty assistant message", () => {
    expect(
      extractLastAssistantMessage([
        { role: "user", content: "调速度" },
        { role: "assistant", content: "我先读文件" },
        { role: "assistant", content: "已将动画时长改为 1s。" },
      ])
    ).toBe("已将动画时长改为 1s。");
  });

  it("formats a markdown fallback for file changes", () => {
    const text = formatModifySummaryFallback({
      userInstruction: "调快动画",
      modifyMode: "code_change",
      diffs: [{ file: "components/Hero.tsx", stats: { additions: 3, deletions: 1 } }],
      iterations: 2,
      buildPassed: true,
      buildSkipped: false,
    });

    expect(text).toContain("修改完成");
    expect(text).toContain("components/Hero.tsx");
    expect(text).toContain("构建验证已通过");
  });

  it("uses assistant notes when read-only with no diffs", () => {
    const text = formatModifySummaryFallback({
      userInstruction: "Hero 在哪",
      modifyMode: "read_only",
      diffs: [],
      iterations: 1,
      buildPassed: false,
      buildSkipped: true,
      assistantNotes: "Hero 在 components/Hero.tsx。",
    });

    expect(text).toBe("Hero 在 components/Hero.tsx。");
  });
});
