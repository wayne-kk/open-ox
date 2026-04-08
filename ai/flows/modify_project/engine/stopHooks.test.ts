import { describe, expect, it } from "vitest";
import { runStopHook, type LoopState } from "./stopHooks";

function baseState(): LoopState {
  return {
    hasEdited: false,
    hasSearched: false,
    hasBuild: false,
    buildPassed: false,
    lastBuildOutput: "",
    fileReadCounts: new Map(),
    fileEditCounts: new Map(),
    consecutiveSameFileOps: 0,
    lastOperatedFile: null,
    phase: "orient",
  };
}

describe("runStopHook", () => {
  it("blocks when no search and no edit happened", () => {
    const msg = runStopHook(baseState(), "改一下首页标题");
    expect(msg).toContain("You stopped without using any tools");
    expect(msg).toContain("list_dir");
  });

  it("blocks when searched but did not edit", () => {
    const state = baseState();
    state.hasSearched = true;
    const msg = runStopHook(state, "调整 footer");
    expect(msg).toContain("didn't make any changes");
  });

  it("passes only when build passed", () => {
    const state = baseState();
    state.hasSearched = true;
    state.hasEdited = true;
    state.hasBuild = true;
    state.buildPassed = true;
    expect(runStopHook(state, "x")).toBeNull();
  });
});
