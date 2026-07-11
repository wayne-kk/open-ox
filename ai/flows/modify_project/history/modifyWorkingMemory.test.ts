import { describe, expect, it } from "vitest";
import type { ModifyHistoryTurn } from "./modifyHistoryTurn";
import {
  FOCUS_LOOKBACK_TURNS,
  PREV_TURN_RESULT_MAX_CHARS,
  SUMMARY_MAX_CHARS,
  buildModifyWorkingMemoryContext,
  projectWorkingMemory,
  truncateForMemory,
} from "./modifyWorkingMemory";

function turn(
  partial: Partial<ModifyHistoryTurn> & Pick<ModifyHistoryTurn, "instruction">
): ModifyHistoryTurn {
  return {
    assistantText: partial.assistantText ?? "",
    touchedFiles: partial.touchedFiles ?? [],
    awaitingReply: partial.awaitingReply ?? false,
    intentCategory: partial.intentCategory,
    instruction: partial.instruction,
  };
}

describe("truncateForMemory", () => {
  it("leaves short text unchanged", () => {
    expect(truncateForMemory("hello", 10)).toBe("hello");
  });

  it("truncates at max and appends ellipsis", () => {
    const text = "a".repeat(SUMMARY_MAX_CHARS + 10);
    const out = truncateForMemory(text, SUMMARY_MAX_CHARS);
    expect(out.length).toBe(SUMMARY_MAX_CHARS + 1);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, SUMMARY_MAX_CHARS)).toBe("a".repeat(SUMMARY_MAX_CHARS));
  });

  it("does not double-ellipsis when already ending with …", () => {
    const base = `${"b".repeat(SUMMARY_MAX_CHARS - 1)}…`;
    expect(truncateForMemory(base, SUMMARY_MAX_CHARS)).toBe(base);
  });
});

describe("projectWorkingMemory", () => {
  it("returns empty card for empty history", () => {
    expect(projectWorkingMemory([])).toEqual({ focusFiles: [] });
  });

  it("projects focusFiles, lastChangeSummary, lastIntent from a code_change turn", () => {
    const memory = projectWorkingMemory([
      turn({
        instruction: "改标题",
        assistantText: "已更新标题",
        touchedFiles: ["app/page.tsx"],
        intentCategory: "code_change",
        awaitingReply: false,
      }),
    ]);
    expect(memory).toEqual({
      focusFiles: ["app/page.tsx"],
      lastIntent: "code_change",
      lastChangeSummary: "已更新标题",
    });
    expect(memory.pendingQuestion).toBeUndefined();
  });

  it("sticks focus and summary across awaiting follow-up then short reply", () => {
    const afterAsk = projectWorkingMemory([
      turn({
        instruction: "改 Hero",
        assistantText: "已放大标题",
        touchedFiles: ["components/Hero.tsx"],
        intentCategory: "code_change",
        awaitingReply: false,
      }),
      turn({
        instruction: "再大一点",
        assistantText: "要多大？",
        touchedFiles: [],
        intentCategory: "conversation",
        awaitingReply: true,
      }),
    ]);
    expect(afterAsk.focusFiles).toEqual(["components/Hero.tsx"]);
    expect(afterAsk.lastChangeSummary).toBe("已放大标题");
    expect(afterAsk.pendingQuestion).toBe("要多大？");
    expect(afterAsk.lastIntent).toBe("conversation");

    const afterReply = projectWorkingMemory([
      ...[
        turn({
          instruction: "改 Hero",
          assistantText: "已放大标题",
          touchedFiles: ["components/Hero.tsx"],
          intentCategory: "code_change",
        }),
        turn({
          instruction: "再大一点",
          assistantText: "要多大？",
          touchedFiles: [],
          intentCategory: "conversation",
          awaitingReply: true,
        }),
      ],
      turn({
        instruction: "再大一点就行",
        assistantText: "好的",
        touchedFiles: [],
        intentCategory: "conversation",
        awaitingReply: false,
      }),
    ]);
    expect(afterReply.focusFiles).toEqual(["components/Hero.tsx"]);
    expect(afterReply.lastChangeSummary).toBe("已放大标题");
    expect(afterReply.pendingQuestion).toBeUndefined();
  });

  it("clears sticky focus when lookback window has no file changes", () => {
    const turns: ModifyHistoryTurn[] = [
      turn({
        instruction: "old change",
        assistantText: "done",
        touchedFiles: ["old.tsx"],
        intentCategory: "code_change",
      }),
    ];
    for (let i = 0; i < FOCUS_LOOKBACK_TURNS; i++) {
      turns.push(
        turn({
          instruction: `chat-${i}`,
          assistantText: "ok",
          touchedFiles: [],
          intentCategory: "conversation",
        })
      );
    }
    const memory = projectWorkingMemory(turns);
    expect(memory.focusFiles).toEqual([]);
    expect(memory.lastChangeSummary).toBeUndefined();
  });

  it("caps focusFiles at 3 preserving order", () => {
    const memory = projectWorkingMemory([
      turn({
        instruction: "改多文件",
        assistantText: "done",
        touchedFiles: ["a.tsx", "b.tsx", "c.tsx", "d.tsx"],
        intentCategory: "code_change",
      }),
    ]);
    expect(memory.focusFiles).toEqual(["a.tsx", "b.tsx", "c.tsx"]);
  });

  it("ignores /clear system turns", () => {
    const memory = projectWorkingMemory([
      turn({
        instruction: "/clear",
        assistantText: "",
        touchedFiles: ["should-not-appear.tsx"],
        intentCategory: "conversation",
      }),
    ]);
    expect(memory).toEqual({ focusFiles: [] });
  });
});

describe("buildModifyWorkingMemoryContext", () => {
  it("returns empty blocks for empty merge / clearContext path", () => {
    const ctx = buildModifyWorkingMemoryContext([], []);
    expect(ctx.agentPromptBlock).toBe("");
    expect(ctx.routerPromptBlock).toBe("");
    expect(ctx.recentTurns).toEqual([]);
    expect(ctx.memory.focusFiles).toEqual([]);
  });

  it("agent block includes working memory + recent turns; router is card-only", () => {
    const ctx = buildModifyWorkingMemoryContext(
      [
        turn({
          instruction: "a",
          assistantText: "A-result",
          touchedFiles: ["x.ts"],
          intentCategory: "code_change",
        }),
      ],
      [
        turn({
          instruction: "b",
          assistantText: "B-result",
          touchedFiles: [],
          intentCategory: "conversation",
          awaitingReply: true,
        }),
      ]
    );

    expect(ctx.agentPromptBlock).toContain("## Working memory");
    expect(ctx.agentPromptBlock).toContain("focusFiles: x.ts");
    expect(ctx.agentPromptBlock).toContain("## Recent turns (oldest first)");
    expect(ctx.agentPromptBlock).toContain('User: "a"');
    expect(ctx.agentPromptBlock).toContain('User: "b"');

    expect(ctx.routerPromptBlock).toContain("## Working memory");
    expect(ctx.routerPromptBlock).toContain("pendingQuestion: B-result");
    expect(ctx.routerPromptBlock).not.toContain("## Recent turns");
    expect(ctx.routerPromptBlock).not.toContain('User: "a"');
  });

  it("asymmetrically truncates older raw turn Result, keeps latest full", () => {
    const longOlder = "O".repeat(PREV_TURN_RESULT_MAX_CHARS + 50);
    const longLatest = "L".repeat(PREV_TURN_RESULT_MAX_CHARS + 50);
    const ctx = buildModifyWorkingMemoryContext(
      [
        turn({
          instruction: "older",
          assistantText: longOlder,
          touchedFiles: ["a.tsx"],
          intentCategory: "code_change",
        }),
        turn({
          instruction: "newer",
          assistantText: longLatest,
          touchedFiles: ["a.tsx"],
          intentCategory: "code_change",
        }),
      ],
      []
    );

    expect(ctx.agentPromptBlock).toContain(
      `Result: ${"O".repeat(PREV_TURN_RESULT_MAX_CHARS)}…`
    );
    expect(ctx.agentPromptBlock).toContain(`Result: ${longLatest}`);
    expect(ctx.agentPromptBlock).not.toContain(
      `Result: ${longLatest}…`
    );
  });

  it("keeps at most two recent turns in the agent block", () => {
    const db = [1, 2, 3].map((n) =>
      turn({
        instruction: `t${n}`,
        assistantText: `r${n}`,
        touchedFiles: n === 1 ? ["f.tsx"] : [],
        intentCategory: n === 1 ? "code_change" : "conversation",
      })
    );
    const ctx = buildModifyWorkingMemoryContext(db, []);
    expect(ctx.recentTurns.map((t) => t.instruction)).toEqual(["t2", "t3"]);
    expect(ctx.agentPromptBlock).not.toContain('User: "t1"');
    expect(ctx.agentPromptBlock).toContain('User: "t2"');
    expect(ctx.agentPromptBlock).toContain('User: "t3"');
  });
});
