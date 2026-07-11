import { describe, expect, it } from "vitest";
import type { ModifyRecord } from "@/app/studio/hooks/useBuildStudio";
import {
  extractModifyHeadline,
  formatModifyDetailsSummary,
  formatTouchedFilesLabel,
  humanizeModifyInstruction,
  isCodeChangeTurn,
  truncateIntent,
} from "./modifyHistoryView";

function baseRecord(overrides: Partial<ModifyRecord> = {}): ModifyRecord {
  return {
    instruction: "把英雄区改成深色",
    plan: null,
    steps: [],
    diffs: [
      {
        file: "components/Hero.tsx",
        reasoning: "",
        patch: "@@\n-a\n+b\n",
        stats: { additions: 2, deletions: 1 },
      },
    ],
    toolCalls: [],
    thinking: [],
    error: null,
    completedAt: new Date().toISOString(),
    intentLabel: "修改",
    ...overrides,
  };
}

describe("modifyHistoryView", () => {
  it("includes code_change turns with diffs", () => {
    expect(isCodeChangeTurn(baseRecord())).toBe(true);
  });

  it("excludes conversation / plan turns even if somehow labeled", () => {
    expect(isCodeChangeTurn(baseRecord({ intentLabel: "对话" }))).toBe(false);
    expect(isCodeChangeTurn(baseRecord({ intentLabel: "规划" }))).toBe(false);
  });

  it("excludes turns without diffs", () => {
    expect(isCodeChangeTurn(baseRecord({ diffs: [] }))).toBe(false);
  });

  it("formats summary without LLM", () => {
    const summary = formatModifyDetailsSummary(baseRecord());
    expect(summary).toContain("把英雄区改成深色");
    expect(summary).toContain("1 个文件");
    expect(summary).toContain("+2");
    expect(summary).toContain("-1");
  });

  it("prefers LLM headline over raw instruction", () => {
    const record = baseRecord({
      instruction: "Studio Design Mode selection (apply changes to this element only):\n- Element: `h1`",
      plan: {
        analysis: "已将访问指南标题改为「Visit Our Studio」。\n\n更新了 VisitGuide.tsx 中的静态文案。",
        changes: [],
      },
    });
    expect(extractModifyHeadline(record)).toBe("已将访问指南标题改为「Visit Our Studio」。");
    expect(formatModifyDetailsSummary(record)).toContain("Visit Our Studio");
  });

  it("humanizes Design Mode selection drafts", () => {
    const draft = [
      "Studio Design Mode selection (apply changes to this element only):",
      "- Element: `span`",
      "- Visible copy: `Visit Us`",
    ].join("\n");
    expect(humanizeModifyInstruction(draft)).toContain("Visit Us");
    expect(humanizeModifyInstruction(draft)).not.toContain("Studio Design Mode");
  });

  it("truncates long intent", () => {
    expect(truncateIntent("a".repeat(100), 20).endsWith("…")).toBe(true);
  });

  it("labels touched files", () => {
    expect(formatTouchedFilesLabel(baseRecord().diffs)).toContain("Hero.tsx");
  });
});
