import { describe, expect, it, vi } from "vitest";
import type { IntentAgentTurn } from "../types/build-studio";
import { processSSEChunk, type IntentSseStreamState } from "./build-studio-api";

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}`;
}

function yieldTurn(message: string): IntentAgentTurn {
  return {
    status: "yield",
    yieldPayload: {
      kind: "options",
      message,
      suggestedReplies: [],
      options: [{ id: "a", label: "选项 A" }],
    },
  };
}

describe("processSSEChunk intent turn hydration", () => {
  it("does not re-fire onIntentTurn from done when intent_agent_turn already arrived", async () => {
    const turn = yieldTurn("为您搭建泡泡玛特宣传站");
    const onIntentTurn = vi.fn();
    const onDone = vi.fn();
    const streamState: IntentSseStreamState = { sawIntentAgentTurn: false };

    await processSSEChunk(
      sseData({ type: "intent_agent_turn", turn }),
      { onStep: vi.fn(), onDone, onError: vi.fn(), onIntentTurn },
      null,
      streamState
    );
    await processSSEChunk(
      sseData({
        type: "done",
        phase: "intent_only",
        result: { projectId: "p1", intentAgent: turn, content: turn.yieldPayload!.message },
      }),
      { onStep: vi.fn(), onDone, onError: vi.fn(), onIntentTurn },
      null,
      streamState
    );

    expect(onIntentTurn).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(streamState.sawIntentAgentTurn).toBe(true);
  });

  it("hydrates onIntentTurn from done when the live turn event was dropped", async () => {
    const turn = yieldTurn("需要补充方向");
    const onIntentTurn = vi.fn();
    const onDone = vi.fn();
    const streamState: IntentSseStreamState = { sawIntentAgentTurn: false };

    await processSSEChunk(
      sseData({
        type: "done",
        phase: "intent_only",
        result: { projectId: "p1", intentAgent: turn, content: turn.yieldPayload!.message },
      }),
      { onStep: vi.fn(), onDone, onError: vi.fn(), onIntentTurn },
      null,
      streamState
    );

    expect(onIntentTurn).toHaveBeenCalledTimes(1);
    expect(onIntentTurn).toHaveBeenCalledWith(turn);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(streamState.sawIntentAgentTurn).toBe(true);
  });
});
