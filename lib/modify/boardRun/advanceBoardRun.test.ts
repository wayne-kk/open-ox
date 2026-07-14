import { describe, expect, it } from "vitest";
import {
  AdvanceBoardRunError,
  advanceBoardRun,
} from "./advanceBoardRun";
import type { BoardRun } from "./boardRunTypes";
import { BOARD_RUN_MAX_TASKS } from "./boardRunTypes";

const fixedNow = () => "2026-07-14T00:00:00.000Z";
let idSeq = 0;
const newId = () => `id-${++idSeq}`;

function opts(online: boolean) {
  return { online, now: fixedNow, newId };
}

function proposeTwo(online = true) {
  idSeq = 0;
  return advanceBoardRun(null, {
    type: "propose",
    projectId: "proj-1",
    goal: "上线前收拾整站",
    tasks: [
      { title: "Pricing", instruction: "对齐 Pricing 文案" },
      { title: "SEO", instruction: "补 SEO meta" },
    ],
  }, opts(online));
}

describe("advanceBoardRun", () => {
  it("propose creates a proposed board with pending tasks and no dispatch", () => {
    const { run, dispatch } = proposeTwo();
    expect(dispatch).toBeNull();
    expect(run.status).toBe("proposed");
    expect(run.projectId).toBe("proj-1");
    expect(run.goal).toBe("上线前收拾整站");
    expect(run.tasks).toHaveLength(2);
    expect(run.tasks.every((t) => t.status === "pending")).toBe(true);
    expect(run.pauseAfterCurrent).toBe(false);
  });

  it("rejects more than max tasks on propose", () => {
    idSeq = 0;
    const tasks = Array.from({ length: BOARD_RUN_MAX_TASKS + 1 }, (_, i) => ({
      title: `T${i}`,
      instruction: `do ${i}`,
    }));
    expect(() =>
      advanceBoardRun(
        null,
        { type: "propose", projectId: "p", goal: "g", tasks },
        opts(true)
      )
    ).toThrow(AdvanceBoardRunError);
  });

  it("confirm while online dispatches the first card and marks it in_flight", () => {
    const proposed = proposeTwo(true).run;
    const { run, dispatch } = advanceBoardRun(
      proposed,
      {
        type: "confirm",
        tasks: proposed.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    );
    expect(run.status).toBe("running");
    expect(dispatch).toEqual({
      taskId: run.tasks[0]!.id,
      instruction: "对齐 Pricing 文案",
    });
    expect(run.tasks[0]!.status).toBe("in_flight");
    expect(run.tasks[1]!.status).toBe("pending");
  });

  it("confirm while offline starts running but does not dispatch", () => {
    const proposed = proposeTwo(false).run;
    const { run, dispatch } = advanceBoardRun(
      proposed,
      {
        type: "confirm",
        tasks: proposed.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(false)
    );
    expect(run.status).toBe("running");
    expect(dispatch).toBeNull();
    expect(run.tasks.every((t) => t.status === "pending")).toBe(true);
  });

  it("happy path: online success advances to the next card", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    const afterFirst = advanceBoardRun(
      state,
      { type: "cardSucceeded", taskId: state.tasks[0]!.id, turnId: "turn-a" },
      opts(true)
    );
    expect(afterFirst.run.tasks[0]!.status).toBe("done");
    expect(afterFirst.run.tasks[0]!.turnIds).toEqual(["turn-a"]);
    expect(afterFirst.dispatch).toEqual({
      taskId: afterFirst.run.tasks[1]!.id,
      instruction: "补 SEO meta",
    });
    expect(afterFirst.run.tasks[1]!.status).toBe("in_flight");

    const afterSecond = advanceBoardRun(
      afterFirst.run,
      { type: "cardSucceeded", taskId: afterFirst.run.tasks[1]!.id },
      opts(true)
    );
    expect(afterSecond.dispatch).toBeNull();
    expect(afterSecond.run.status).toBe("completed");
    expect(afterSecond.run.tasks.every((t) => t.status === "done")).toBe(true);
  });

  it("success while offline does not dispatch the next card", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    const { run, dispatch } = advanceBoardRun(
      state,
      { type: "cardSucceeded", taskId: state.tasks[0]!.id },
      opts(false)
    );
    expect(dispatch).toBeNull();
    expect(run.status).toBe("running");
    expect(run.tasks[0]!.status).toBe("done");
    expect(run.tasks[1]!.status).toBe("pending");
  });

  it("continue while online dispatches the next pending card", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;
    state = advanceBoardRun(
      state,
      { type: "cardSucceeded", taskId: state.tasks[0]!.id },
      opts(false)
    ).run;

    const { run, dispatch } = advanceBoardRun(state, { type: "continue" }, opts(true));
    expect(dispatch).toEqual({
      taskId: run.tasks[1]!.id,
      instruction: "补 SEO meta",
    });
    expect(run.tasks[1]!.status).toBe("in_flight");
  });

  it("fail-stop does not auto-advance", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    const { run, dispatch } = advanceBoardRun(
      state,
      { type: "cardFailed", taskId: state.tasks[0]!.id },
      opts(true)
    );
    expect(dispatch).toBeNull();
    expect(run.status).toBe("failed");
    expect(run.tasks[0]!.status).toBe("failed");
    expect(run.tasks[1]!.status).toBe("pending");
  });

  it("pause blocks next dispatch after current card succeeds", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    state = advanceBoardRun(state, { type: "pause" }, opts(true)).run;
    expect(state.pauseAfterCurrent).toBe(true);
    expect(state.status).toBe("paused");
    // in-flight card still in_flight — pause does not hard-abort
    expect(state.tasks[0]!.status).toBe("in_flight");

    const afterSuccess = advanceBoardRun(
      state,
      { type: "cardSucceeded", taskId: state.tasks[0]!.id },
      opts(true)
    );
    expect(afterSuccess.dispatch).toBeNull();
    expect(afterSuccess.run.status).toBe("paused");
    expect(afterSuccess.run.tasks[1]!.status).toBe("pending");
  });

  it("retry after failure re-dispatches the same task slot", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;
    state = advanceBoardRun(
      state,
      { type: "cardFailed", taskId: state.tasks[0]!.id },
      opts(true)
    ).run;

    const { run, dispatch } = advanceBoardRun(
      state,
      { type: "retry", taskId: state.tasks[0]!.id },
      opts(true)
    );
    expect(run.status).toBe("running");
    expect(dispatch).toEqual({
      taskId: run.tasks[0]!.id,
      instruction: "对齐 Pricing 文案",
    });
    expect(run.tasks[0]!.status).toBe("in_flight");
  });

  it("skip after failure advances to the next card when online", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;
    state = advanceBoardRun(
      state,
      { type: "cardFailed", taskId: state.tasks[0]!.id },
      opts(true)
    ).run;

    const { run, dispatch } = advanceBoardRun(
      state,
      { type: "skip", taskId: state.tasks[0]!.id },
      opts(true)
    );
    expect(run.tasks[0]!.status).toBe("skipped");
    expect(dispatch).toEqual({
      taskId: run.tasks[1]!.id,
      instruction: "补 SEO meta",
    });
  });

  it("cancelRemaining cancels pending tasks and keeps completed writes", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;
    state = advanceBoardRun(
      state,
      { type: "cardSucceeded", taskId: state.tasks[0]!.id },
      opts(false)
    ).run;

    const { run, dispatch } = advanceBoardRun(
      state,
      { type: "cancelRemaining" },
      opts(true)
    );
    expect(dispatch).toBeNull();
    expect(run.status).toBe("cancelled");
    expect(run.tasks[0]!.status).toBe("done");
    expect(run.tasks[1]!.status).toBe("cancelled");
  });

  it("revise updates tasks while proposed", () => {
    const proposed = proposeTwo(true).run;
    const { run, dispatch } = advanceBoardRun(
      proposed,
      {
        type: "revise",
        tasks: [
          { title: "A", instruction: "do a" },
          { title: "B", instruction: "do b" },
          { title: "C", instruction: "do c" },
        ],
      },
      opts(true)
    );
    expect(dispatch).toBeNull();
    expect(run.status).toBe("proposed");
    expect(run.tasks).toHaveLength(3);
    expect(run.tasks.map((t) => t.title)).toEqual(["A", "B", "C"]);
  });

  it("rejects a second dispatch while a card is in_flight", () => {
    let state = proposeTwo(true).run;
    state = advanceBoardRun(
      state,
      {
        type: "confirm",
        tasks: state.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    expect(() =>
      advanceBoardRun(state, { type: "continue" }, opts(true))
    ).toThrow(AdvanceBoardRunError);
  });
});

describe("boardRunStore memory round-trip", () => {
  it("saves and reloads an incomplete BoardRun by project id", async () => {
    const { MemoryBoardRunStore } = await import("./boardRunStore");
    const store = new MemoryBoardRunStore();
    const { run } = proposeTwo(true);
    const confirmed = advanceBoardRun(
      run,
      {
        type: "confirm",
        tasks: run.tasks.map((t) => ({
          title: t.title,
          instruction: t.instruction,
        })),
      },
      opts(true)
    ).run;

    await store.save(confirmed);
    const loaded = await store.loadActive(confirmed.projectId);
    expect(loaded).toEqual(confirmed);
    expect(loaded?.status).toBe("running");
    expect(loaded?.tasks[0]?.status).toBe("in_flight");
  });

  it("clear removes active board for the project", async () => {
    const { MemoryBoardRunStore } = await import("./boardRunStore");
    const store = new MemoryBoardRunStore();
    const run: BoardRun = proposeTwo(true).run;
    await store.save(run);
    await store.clear(run.projectId);
    expect(await store.loadActive(run.projectId)).toBeNull();
  });
});
