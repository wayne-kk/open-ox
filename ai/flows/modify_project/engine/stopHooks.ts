import type { ModifyProfile } from "../profile/modifyProfile";

export interface LoopState {
  hasEdited: boolean;
  hasSearched: boolean;
  /** Legacy — set only by post-loop final verification. */
  hasBuild: boolean;
  buildPassed: boolean;
  lastBuildOutput: string;
  fileReadCounts: Map<string, number>;
  fileEditCounts: Map<string, number>;
  consecutiveSameFileOps: number;
  lastOperatedFile: string | null;
  phase: "orient" | "read" | "edit" | "verify";
  touchedFiles: string[];
  openTypeErrors: number;
  hasScopedTsc: boolean;
  scopedTscPassed: boolean;
}

export type ModifyStopMode = "code_change" | "read_only";

export type StopHookOptions = {
  profile?: ModifyProfile;
};

function noToolsBlockingMessage(userInstruction: string, modifyMode: ModifyStopMode): string {
  if (modifyMode === "read_only") {
    return `You stopped without using any tools. The user asked: "${userInstruction}"

This session is read-only Q&A. Use list_dir, search_code, and read_file to explore the project (pick paths from the file tree already in context). When you have enough evidence, reply with a complete answer in the user's language. Do NOT edit files.`;
  }

  return `You stopped without using any tools. The user asked: "${userInstruction}"

Explore the codebase before editing: use list_dir, search_code, and read_file on paths relevant to the request (from the project file tree in context). Then apply changes with edit_file.

Do NOT respond with text only until you have read or searched the repo.`;
}

/**
 * Runs when LLM stops calling tools. Returns null if task is complete,
 * or a blocking error message that gets injected back into the conversation.
 *
 * No keyword extraction or path allowlists — only loop state + profile from the intent router.
 * Production build is **not** required inside the loop — {@link runFinalVerification} runs once after the loop.
 */
export function runStopHook(
  loopState: LoopState,
  userInstruction: string,
  modifyMode: ModifyStopMode = "code_change",
  options?: StopHookOptions
): string | null {
  if (!loopState.hasSearched && !loopState.hasEdited) {
    return noToolsBlockingMessage(userInstruction, modifyMode);
  }

  if (modifyMode === "read_only" && loopState.hasSearched && !loopState.hasEdited) {
    return null;
  }

  if (modifyMode === "code_change" && !loopState.hasEdited) {
    return `You searched but didn't make any changes. The user asked you to modify something.

If you found the relevant files, read them and make the edits now with edit_file.
If you're unsure which component the user means, explain what you found and ask a specific question — include the file names you discovered so the user can point you to the right one.

Do not give up without explaining your search results.`;
  }

  if (loopState.openTypeErrors > 0) {
    return `Type-check errors remain after your edits (${loopState.openTypeErrors} file(s) reported errors). Fix them with edit_file before finishing.`;
  }

  if (loopState.hasScopedTsc && !loopState.scopedTscPassed) {
    return `run_scoped_tsc failed. Fix the reported TypeScript errors and call run_scoped_tsc again, or fix via edit_file.`;
  }

  const profile = options?.profile;
  const canFinishWithoutScopedTsc =
    modifyMode === "read_only" ||
    profile?.verificationMode === "tsc_only" ||
    profile?.verificationMode === "none";

  if (canFinishWithoutScopedTsc || loopState.scopedTscPassed) {
    return null;
  }

  if (!loopState.hasScopedTsc && loopState.touchedFiles.some((f) => /\.(tsx?|jsx?)$/.test(f))) {
    return "Call run_scoped_tsc once to verify your TS/TSX edits, then stop. Full production build runs automatically after you finish.";
  }

  return null;
}
