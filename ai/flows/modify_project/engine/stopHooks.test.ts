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
    touchedFiles: [],
    openTypeErrors: 0,
    hasScopedTsc: false,
    scopedTscPassed: false,
  };
}

describe("runStopHook", () => {
  it("blocks code_change when no search and no edit", () => {
    const msg = runStopHook(baseState(), "改一下首页标题", "code_change");
    expect(msg).toContain("You stopped without using any tools");
    expect(msg).toContain("改一下首页标题");
    expect(msg).not.toContain("components/sections");
  });

  it("blocks read_only with Q&A guidance when no tools used", () => {
    const msg = runStopHook(baseState(), "Hero 怎么实现的", "read_only");
    expect(msg).toContain("read-only Q&A");
    expect(msg).not.toContain("edit_file");
  });

  it("allows stop after exploration when modifyMode is read_only", () => {
    const state = baseState();
    state.hasSearched = true;
    expect(runStopHook(state, "解释一下 Hero", "read_only")).toBeNull();
  });

  it("blocks code_change when searched but did not edit", () => {
    const state = baseState();
    state.hasSearched = true;
    const msg = runStopHook(state, "调整 footer", "code_change");
    expect(msg).toContain("didn't make any changes");
  });

  it("allows stop after edits when router profile is tsc_only", () => {
    const state = baseState();
    state.hasSearched = true;
    state.hasEdited = true;
    state.openTypeErrors = 0;
    expect(
      runStopHook(state, "x", "code_change", {
        profile: {
          category: "code_change",
          scope: "style",
          allowEdits: true,
          verificationMode: "tsc_only",
          allowWriteFile: false,
          maxIterations: 10,
          modelId: "gemini-3-flash-preview",
          usePlannedWideFlow: false,
        },
      })
    ).toBeNull();
  });
});
