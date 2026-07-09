import { describe, expect, it } from "vitest";
import {
  buildHistoryContext,
  computeAwaitingReply,
  formatHistoryForAgent,
  formatRecentHistoryForRouter,
  fromClientPayload,
  fromModificationRecord,
  splitLegacySummary,
  toClientHistoryPayload,
  type ModifyHistoryTurn,
} from "./modifyHistoryTurn";

describe("modifyHistoryTurn", () => {
  it("splits legacy summary Files: suffix", () => {
    expect(splitLegacySummary("速度需要调整到多少？ Files: ")).toEqual({
      assistantText: "速度需要调整到多少？",
      touchedFiles: [],
    });
    expect(splitLegacySummary("Done. Files: a.ts, b.tsx")).toEqual({
      assistantText: "Done.",
      touchedFiles: ["a.ts", "b.tsx"],
    });
  });

  it("computes awaitingReply from structured fields", () => {
    expect(computeAwaitingReply("速度需要调整到多少？", [])).toBe(true);
    expect(computeAwaitingReply("已改完标题。", ["app/page.tsx"])).toBe(false);
    expect(computeAwaitingReply("确认执行请说「按这个计划修改」", [])).toBe(true);
  });

  it("maps ModificationRecord without embedding Files into assistantText", () => {
    const turn = fromModificationRecord({
      instruction: "改标题",
      modifiedAt: "2026-01-01T00:00:00.000Z",
      touchedFiles: ["app/page.tsx"],
      plan: { analysis: "已更新标题", changes: [] },
      intentCategory: "code_change",
    });
    expect(turn.assistantText).toBe("已更新标题");
    expect(turn.touchedFiles).toEqual(["app/page.tsx"]);
    expect(turn.intentCategory).toBe("code_change");
    expect(turn.awaitingReply).toBe(false);
  });

  it("strips legacy Files: baked into plan.analysis", () => {
    const turn = fromModificationRecord({
      instruction: "改标题",
      modifiedAt: "2026-01-01T00:00:00.000Z",
      touchedFiles: ["app/page.tsx"],
      plan: { analysis: "已更新标题 Files: app/page.tsx", changes: [] },
    });
    expect(turn.assistantText).toBe("已更新标题");
  });

  it("dual-reads structured and legacy client payloads", () => {
    const structured = fromClientPayload({
      instruction: "1",
      assistantText: "速度需要调整到多少？",
      touchedFiles: [],
      intentCategory: "code_change",
    });
    expect(structured?.awaitingReply).toBe(true);
    expect(structured?.assistantText).toBe("速度需要调整到多少？");

    const legacy = fromClientPayload({
      instruction: "1",
      summary: "速度需要调整到多少？ Files: ",
      intentCategory: "code_change",
    });
    expect(legacy?.awaitingReply).toBe(true);
    expect(legacy?.touchedFiles).toEqual([]);
  });

  it("builds client payload without Files: in assistantText", () => {
    const payload = toClientHistoryPayload({
      instruction: "改标题",
      analysis: "已更新",
      touchedFiles: ["app/page.tsx"],
      intentCategory: "code_change",
    });
    expect(payload).toEqual({
      instruction: "改标题",
      assistantText: "已更新",
      touchedFiles: ["app/page.tsx"],
      intentCategory: "code_change",
    });
  });

  it("formats agent history with separate Files line; router omits files", () => {
    const turns: ModifyHistoryTurn[] = [
      {
        instruction: "改标题",
        assistantText: "已更新标题",
        touchedFiles: ["app/page.tsx"],
        awaitingReply: false,
      },
    ];
    const agent = formatHistoryForAgent(turns);
    expect(agent).toContain("Result: 已更新标题");
    expect(agent).toContain("Files: app/page.tsx");

    const router = formatRecentHistoryForRouter(turns);
    expect(router).toContain("Assistant: 已更新标题");
    expect(router).not.toContain("Files:");
  });

  it("buildHistoryContext merges and caps turns", () => {
    const db: ModifyHistoryTurn[] = [
      {
        instruction: "a",
        assistantText: "A",
        touchedFiles: [],
        awaitingReply: false,
      },
    ];
    const session: ModifyHistoryTurn[] = [
      {
        instruction: "b",
        assistantText: "B",
        touchedFiles: ["x.ts"],
        awaitingReply: false,
      },
    ];
    const ctx = buildHistoryContext(db, session);
    expect(ctx).toContain('User: "a"');
    expect(ctx).toContain('User: "b"');
    expect(ctx).toContain("Files: x.ts");
  });
});
