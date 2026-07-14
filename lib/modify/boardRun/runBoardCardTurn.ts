import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AdvanceBoardRunError,
  advanceBoardRun,
} from "./advanceBoardRun";
import { formatBoardSummaryBlock } from "./formatBoardSummaryBlock";
import { getBoardRunStore } from "./fileBoardRunStore";
import type { BoardDispatch, BoardRun } from "./boardRunTypes";
import {
  runHeadlessModifyTurn,
  type HeadlessModifyResult,
} from "@/lib/modify/runHeadlessModifyTurn";

export type RunBoardCardTurnResult = {
  boardRun: BoardRun;
  dispatch: BoardDispatch | null;
  modify: HeadlessModifyResult | null;
};

type DispatchCommand =
  | { type: "continue" }
  | { type: "retry"; taskId: string }
  | { type: "skip"; taskId: string };

function inFlightDispatch(run: BoardRun): BoardDispatch | null {
  const task = run.tasks.find((t) => t.status === "in_flight");
  if (!task) return null;
  return { taskId: task.id, instruction: task.instruction };
}

/**
 * Phase 1: mark the next card in_flight (or resume an existing in_flight) and return.
 * Does not run Modify — so the client can paint progress before the long card starts.
 */
export async function prepareBoardCardTurn(input: {
  projectId: string;
  command: DispatchCommand;
}): Promise<RunBoardCardTurnResult> {
  const store = getBoardRunStore();
  const current = await store.loadActive(input.projectId);
  if (!current) {
    throw new AdvanceBoardRunError("invalid_state", "No active BoardRun for this project");
  }

  const existing = inFlightDispatch(current);
  if (existing) {
    // Resume a card left in_flight (e.g. refresh mid-execute).
    return { boardRun: current, dispatch: existing, modify: null };
  }

  const advanced = advanceBoardRun(current, input.command, { online: true });
  await store.save(advanced.run);
  return { boardRun: advanced.run, dispatch: advanced.dispatch, modify: null };
}

/**
 * Phase 2: run Modify for the current in_flight card, then record success/failure
 * with online:false so the server never drains the rest of the queue unattended.
 */
export async function executeBoardCardTurn(
  db: SupabaseClient,
  input: {
    userId: string;
    projectId: string;
  }
): Promise<RunBoardCardTurnResult> {
  const store = getBoardRunStore();
  const current = await store.loadActive(input.projectId);
  if (!current) {
    throw new AdvanceBoardRunError("invalid_state", "No active BoardRun for this project");
  }

  const dispatch = inFlightDispatch(current);
  if (!dispatch) {
    throw new AdvanceBoardRunError(
      "invalid_state",
      "No in_flight card to execute — call prepare/run_next first"
    );
  }

  const summary = formatBoardSummaryBlock(current, dispatch.taskId);
  const modify = await runHeadlessModifyTurn(db, {
    userId: input.userId,
    projectId: input.projectId,
    instruction: dispatch.instruction,
    forceFreshInstruction: true,
    boardSummaryBlock: summary,
    forceSingleModify: true,
  });

  const latest = (await store.loadActive(input.projectId)) ?? current;

  if (modify.ok) {
    const turnId = new Date().toISOString();
    const after = advanceBoardRun(
      latest,
      {
        type: "cardSucceeded",
        taskId: dispatch.taskId,
        turnId,
      },
      { online: false }
    );
    await store.save(after.run);
    return { boardRun: after.run, dispatch, modify };
  }

  const after = advanceBoardRun(
    latest,
    { type: "cardFailed", taskId: dispatch.taskId },
    { online: false }
  );
  await store.save(after.run);
  return { boardRun: after.run, dispatch, modify };
}

/**
 * Legacy one-shot helper (tests / callers that don't need mid-flight UI).
 */
export async function runBoardCardTurn(
  db: SupabaseClient,
  input: {
    userId: string;
    projectId: string;
    command: DispatchCommand;
  }
): Promise<RunBoardCardTurnResult> {
  const prepared = await prepareBoardCardTurn({
    projectId: input.projectId,
    command: input.command,
  });
  if (!prepared.dispatch) {
    return prepared;
  }
  return executeBoardCardTurn(db, {
    userId: input.userId,
    projectId: input.projectId,
  });
}
