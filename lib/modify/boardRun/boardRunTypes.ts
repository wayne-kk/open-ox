/**
 * Modify BoardRun — durable task-slice board for wide Modifies (v0.1).
 * See `.scratch/modify-board-run-v0.1/PRD.md`.
 */

export const BOARD_RUN_MAX_TASKS = 6;

export type BoardRunStatus =
  | "proposed"
  | "running"
  | "paused"
  | "failed"
  | "completed"
  | "cancelled";

export type BoardTaskStatus =
  | "pending"
  | "in_flight"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled";

export type BoardTask = {
  id: string;
  title: string;
  instruction: string;
  status: BoardTaskStatus;
  /** Modify History Turn keys / ids completed for this slot (retries append). */
  turnIds: string[];
};

export type BoardRun = {
  id: string;
  projectId: string;
  goal: string;
  status: BoardRunStatus;
  tasks: BoardTask[];
  /** When true, do not dispatch the next card after the in-flight one finishes. */
  pauseAfterCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BoardTaskInput = {
  title: string;
  instruction: string;
};

export type BoardDispatch = {
  taskId: string;
  instruction: string;
};

export type AdvanceBoardRunOptions = {
  /**
   * Online/continue signal. Next-card dispatch after success only when true.
   * Closing Studio ⇒ treat as offline so the queue does not drain unattended.
   */
  online: boolean;
  /** Injected clock for tests. */
  now?: () => string;
  /** Injected id factory for tests. */
  newId?: () => string;
};

export type BoardCommand =
  | { type: "propose"; projectId: string; goal: string; tasks: BoardTaskInput[] }
  | { type: "revise"; tasks: BoardTaskInput[] }
  | { type: "confirm"; tasks: BoardTaskInput[] }
  | { type: "pause" }
  | { type: "continue" }
  | { type: "cardSucceeded"; taskId: string; turnId?: string }
  | { type: "cardFailed"; taskId: string }
  | { type: "retry"; taskId: string }
  | { type: "skip"; taskId: string }
  | { type: "cancelRemaining" };

export type AdvanceBoardRunResult = {
  run: BoardRun;
  dispatch: BoardDispatch | null;
};

export type AdvanceBoardRunErrorCode =
  | "empty_tasks"
  | "too_many_tasks"
  | "invalid_task"
  | "invalid_state"
  | "unknown_task"
  | "busy_card";

export class AdvanceBoardRunError extends Error {
  readonly code: AdvanceBoardRunErrorCode;

  constructor(code: AdvanceBoardRunErrorCode, message: string) {
    super(message);
    this.name = "AdvanceBoardRunError";
    this.code = code;
  }
}
