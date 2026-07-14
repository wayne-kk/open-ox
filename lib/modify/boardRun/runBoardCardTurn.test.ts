import { describe, expect, it, vi, beforeEach } from "vitest";
import { advanceBoardRun } from "./advanceBoardRun";
import { MemoryBoardRunStore } from "./boardRunStore";
import { __setBoardRunStoreForTests } from "./fileBoardRunStore";

vi.mock("@/lib/modify/runHeadlessModifyTurn", () => ({
  runHeadlessModifyTurn: vi.fn(async () => ({
    ok: true,
    assistantText: "done",
    touchedFiles: ["app/page.tsx"],
    awaitingReply: false,
    charged: 1,
    balanceAfter: 10,
  })),
}));

describe("prepareBoardCardTurn + executeBoardCardTurn", () => {
  let store: MemoryBoardRunStore;

  beforeEach(() => {
    store = new MemoryBoardRunStore();
    __setBoardRunStoreForTests(store);
  });

  it("prepare marks in_flight without running Modify; execute finishes the card", async () => {
    const { prepareBoardCardTurn, executeBoardCardTurn } = await import("./runBoardCardTurn");
    const { runHeadlessModifyTurn } = await import("@/lib/modify/runHeadlessModifyTurn");

    let seq = 0;
    const opts = { online: false as const, now: () => "t", newId: () => `id-${++seq}` };
    let run = advanceBoardRun(
      null,
      {
        type: "propose",
        projectId: "proj-board",
        goal: "goal",
        tasks: [
          { title: "A", instruction: "do A" },
          { title: "B", instruction: "do B" },
        ],
      },
      opts
    ).run;
    run = advanceBoardRun(
      run,
      {
        type: "confirm",
        tasks: run.tasks.map((t) => ({ title: t.title, instruction: t.instruction })),
      },
      opts
    ).run;
    await store.save(run);

    const prepared = await prepareBoardCardTurn({
      projectId: "proj-board",
      command: { type: "continue" },
    });
    expect(prepared.dispatch?.instruction).toBe("do A");
    expect(prepared.boardRun.tasks[0]?.status).toBe("in_flight");
    expect(prepared.modify).toBeNull();
    expect(runHeadlessModifyTurn).not.toHaveBeenCalled();

    const executed = await executeBoardCardTurn({} as never, {
      userId: "u1",
      projectId: "proj-board",
    });
    expect(runHeadlessModifyTurn).toHaveBeenCalledOnce();
    expect(executed.boardRun.tasks[0]?.status).toBe("done");
    expect(executed.boardRun.tasks[1]?.status).toBe("pending");
    expect(executed.boardRun.status).toBe("running");
  });
});
