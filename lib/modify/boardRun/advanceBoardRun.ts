import {
  AdvanceBoardRunError,
  BOARD_RUN_MAX_TASKS,
  type AdvanceBoardRunOptions,
  type AdvanceBoardRunResult,
  type BoardCommand,
  type BoardDispatch,
  type BoardRun,
  type BoardTask,
  type BoardTaskInput,
} from "./boardRunTypes";

export { AdvanceBoardRunError, BOARD_RUN_MAX_TASKS } from "./boardRunTypes";
export type {
  AdvanceBoardRunOptions,
  AdvanceBoardRunResult,
  BoardCommand,
  BoardDispatch,
  BoardRun,
  BoardTask,
  BoardTaskInput,
} from "./boardRunTypes";

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultNewId(): string {
  return crypto.randomUUID();
}

function validateTaskInputs(tasks: BoardTaskInput[]): void {
  if (tasks.length === 0) {
    throw new AdvanceBoardRunError("empty_tasks", "BoardRun requires at least one task");
  }
  if (tasks.length > BOARD_RUN_MAX_TASKS) {
    throw new AdvanceBoardRunError(
      "too_many_tasks",
      `BoardRun allows at most ${BOARD_RUN_MAX_TASKS} tasks`
    );
  }
  for (const task of tasks) {
    if (!task.title.trim() || !task.instruction.trim()) {
      throw new AdvanceBoardRunError(
        "invalid_task",
        "Each task needs a non-empty title and instruction"
      );
    }
  }
}

function touch(run: BoardRun, now: string): BoardRun {
  return { ...run, updatedAt: now };
}

function requireRun(run: BoardRun | null): BoardRun {
  if (!run) {
    throw new AdvanceBoardRunError("invalid_state", "BoardRun is required for this command");
  }
  return run;
}

function findInFlight(run: BoardRun): BoardTask | undefined {
  return run.tasks.find((t) => t.status === "in_flight");
}

function firstPending(run: BoardRun): BoardTask | undefined {
  return run.tasks.find((t) => t.status === "pending");
}

function allTerminal(run: BoardRun): boolean {
  return run.tasks.every((t) =>
    t.status === "done" || t.status === "skipped" || t.status === "cancelled"
  );
}

function mapTasks(
  inputs: BoardTaskInput[],
  newId: () => string
): BoardTask[] {
  return inputs.map((input) => ({
    id: newId(),
    title: input.title.trim(),
    instruction: input.instruction.trim(),
    status: "pending" as const,
    turnIds: [],
  }));
}

function replaceTask(run: BoardRun, taskId: string, next: BoardTask): BoardRun {
  return {
    ...run,
    tasks: run.tasks.map((t) => (t.id === taskId ? next : t)),
  };
}

function requireTask(run: BoardRun, taskId: string): BoardTask {
  const task = run.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new AdvanceBoardRunError("unknown_task", `Unknown task: ${taskId}`);
  }
  return task;
}

function tryDispatchNext(
  run: BoardRun,
  online: boolean,
  now: string
): AdvanceBoardRunResult {
  if (!online) {
    return { run: touch(run, now), dispatch: null };
  }
  if (run.pauseAfterCurrent) {
    return {
      run: touch({ ...run, status: "paused" }, now),
      dispatch: null,
    };
  }
  if (findInFlight(run)) {
    throw new AdvanceBoardRunError(
      "busy_card",
      "A card is already in flight; wait for it to finish"
    );
  }
  if (run.status === "failed") {
    return { run: touch(run, now), dispatch: null };
  }

  const next = firstPending(run);
  if (!next) {
    const status = allTerminal(run) ? "completed" : run.status;
    return { run: touch({ ...run, status }, now), dispatch: null };
  }

  const updated = replaceTask(run, next.id, { ...next, status: "in_flight" });
  const dispatch: BoardDispatch = {
    taskId: next.id,
    instruction: next.instruction,
  };
  return {
    run: touch({ ...updated, status: "running", pauseAfterCurrent: false }, now),
    dispatch,
  };
}

/**
 * Pure BoardRun orchestrator — primary test seam for modify board v0.1.
 * Does not call the Modify runner; callers apply `dispatch` when present.
 */
export function advanceBoardRun(
  run: BoardRun | null,
  command: BoardCommand,
  options: AdvanceBoardRunOptions
): AdvanceBoardRunResult {
  const now = (options.now ?? defaultNow)();
  const newId = options.newId ?? defaultNewId;
  const { online } = options;

  switch (command.type) {
    case "propose": {
      validateTaskInputs(command.tasks);
      const created: BoardRun = {
        id: newId(),
        projectId: command.projectId,
        goal: command.goal.trim(),
        status: "proposed",
        tasks: mapTasks(command.tasks, newId),
        pauseAfterCurrent: false,
        createdAt: now,
        updatedAt: now,
      };
      return { run: created, dispatch: null };
    }

    case "revise": {
      const current = requireRun(run);
      if (current.status !== "proposed") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only a proposed BoardRun can be revised"
        );
      }
      validateTaskInputs(command.tasks);
      return {
        run: touch(
          {
            ...current,
            tasks: mapTasks(command.tasks, newId),
          },
          now
        ),
        dispatch: null,
      };
    }

    case "confirm": {
      const current = requireRun(run);
      if (current.status !== "proposed") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only a proposed BoardRun can be confirmed"
        );
      }
      validateTaskInputs(command.tasks);
      const confirmed: BoardRun = {
        ...current,
        tasks: mapTasks(command.tasks, newId),
        status: "running",
        pauseAfterCurrent: false,
        updatedAt: now,
      };
      return tryDispatchNext(confirmed, online, now);
    }

    case "pause": {
      const current = requireRun(run);
      if (
        current.status === "completed" ||
        current.status === "cancelled" ||
        current.status === "proposed"
      ) {
        throw new AdvanceBoardRunError(
          "invalid_state",
          `Cannot pause a BoardRun in status ${current.status}`
        );
      }
      return {
        run: touch(
          {
            ...current,
            pauseAfterCurrent: true,
            status: "paused",
          },
          now
        ),
        dispatch: null,
      };
    }

    case "continue": {
      const current = requireRun(run);
      if (current.status === "completed" || current.status === "cancelled") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          `Cannot continue a BoardRun in status ${current.status}`
        );
      }
      if (current.status === "failed") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Failed BoardRun needs retry or skip before continue"
        );
      }
      const resumed = {
        ...current,
        pauseAfterCurrent: false,
        status: "running" as const,
      };
      return tryDispatchNext(resumed, online, now);
    }

    case "cardSucceeded": {
      const current = requireRun(run);
      const task = requireTask(current, command.taskId);
      if (task.status !== "in_flight") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only an in_flight card can succeed"
        );
      }
      const turnIds = command.turnId
        ? [...task.turnIds, command.turnId]
        : task.turnIds;
      let nextRun = replaceTask(current, task.id, {
        ...task,
        status: "done",
        turnIds,
      });

      if (nextRun.pauseAfterCurrent) {
        return {
          run: touch({ ...nextRun, status: "paused" }, now),
          dispatch: null,
        };
      }

      if (allTerminal(nextRun)) {
        return {
          run: touch({ ...nextRun, status: "completed" }, now),
          dispatch: null,
        };
      }

      nextRun = { ...nextRun, status: "running" };
      return tryDispatchNext(nextRun, online, now);
    }

    case "cardFailed": {
      const current = requireRun(run);
      const task = requireTask(current, command.taskId);
      if (task.status !== "in_flight") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only an in_flight card can fail"
        );
      }
      const nextRun = replaceTask(current, task.id, {
        ...task,
        status: "failed",
      });
      return {
        run: touch({ ...nextRun, status: "failed", pauseAfterCurrent: false }, now),
        dispatch: null,
      };
    }

    case "retry": {
      const current = requireRun(run);
      const task = requireTask(current, command.taskId);
      if (task.status !== "failed") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only a failed card can be retried"
        );
      }
      if (findInFlight(current)) {
        throw new AdvanceBoardRunError(
          "busy_card",
          "A card is already in flight; wait for it to finish"
        );
      }
      const reset = replaceTask(current, task.id, {
        ...task,
        status: "pending",
      });
      const resumed = {
        ...reset,
        status: "running" as const,
        pauseAfterCurrent: false,
      };
      return tryDispatchNext(resumed, online, now);
    }

    case "skip": {
      const current = requireRun(run);
      const task = requireTask(current, command.taskId);
      if (task.status !== "failed" && task.status !== "pending") {
        throw new AdvanceBoardRunError(
          "invalid_state",
          "Only a failed or pending card can be skipped"
        );
      }
      if (findInFlight(current)) {
        throw new AdvanceBoardRunError(
          "busy_card",
          "A card is already in flight; wait for it to finish"
        );
      }
      let nextRun = replaceTask(current, task.id, {
        ...task,
        status: "skipped",
      });
      if (allTerminal(nextRun)) {
        return {
          run: touch({ ...nextRun, status: "completed" }, now),
          dispatch: null,
        };
      }
      nextRun = {
        ...nextRun,
        status: "running",
        pauseAfterCurrent: false,
      };
      return tryDispatchNext(nextRun, online, now);
    }

    case "cancelRemaining": {
      const current = requireRun(run);
      if (current.status === "proposed") {
        return {
          run: touch(
            {
              ...current,
              status: "cancelled",
              tasks: current.tasks.map((t) =>
                t.status === "pending" ? { ...t, status: "cancelled" as const } : t
              ),
            },
            now
          ),
          dispatch: null,
        };
      }
      if (findInFlight(current)) {
        // Queue-only cancel: do not hard-abort in-flight; cancel pending only.
        const nextTasks = current.tasks.map((t) =>
          t.status === "pending" ? { ...t, status: "cancelled" as const } : t
        );
        return {
          run: touch(
            {
              ...current,
              tasks: nextTasks,
              pauseAfterCurrent: true,
              status: "paused",
            },
            now
          ),
          dispatch: null,
        };
      }
      const nextTasks = current.tasks.map((t) =>
        t.status === "pending" ? { ...t, status: "cancelled" as const } : t
      );
      return {
        run: touch(
          {
            ...current,
            tasks: nextTasks,
            pauseAfterCurrent: false,
            status: "cancelled",
          },
          now
        ),
        dispatch: null,
      };
    }

    default: {
      const _exhaustive: never = command;
      throw new AdvanceBoardRunError(
        "invalid_state",
        `Unknown command: ${JSON.stringify(_exhaustive)}`
      );
    }
  }
}
