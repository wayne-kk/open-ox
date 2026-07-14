import { describe, expect, it } from "vitest";
import { isBoardRunBlocking } from "./isBoardRunBlocking";
import type { BoardRun } from "./boardRunTypes";

function run(status: BoardRun["status"]): BoardRun {
  return {
    id: "b",
    projectId: "p",
    goal: "g",
    status,
    tasks: [],
    pauseAfterCurrent: false,
    createdAt: "t",
    updatedAt: "t",
  };
}

describe("isBoardRunBlocking", () => {
  it("blocks proposed / running / paused / failed", () => {
    expect(isBoardRunBlocking(run("proposed"))).toBe(true);
    expect(isBoardRunBlocking(run("running"))).toBe(true);
    expect(isBoardRunBlocking(run("paused"))).toBe(true);
    expect(isBoardRunBlocking(run("failed"))).toBe(true);
  });

  it("does not block completed / cancelled / null", () => {
    expect(isBoardRunBlocking(run("completed"))).toBe(false);
    expect(isBoardRunBlocking(run("cancelled"))).toBe(false);
    expect(isBoardRunBlocking(null)).toBe(false);
  });
});
