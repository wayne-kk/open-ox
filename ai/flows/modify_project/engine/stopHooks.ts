export interface LoopState {
  hasEdited: boolean;
  hasSearched: boolean;
  hasBuild: boolean;
  buildPassed: boolean;
  lastBuildOutput: string;
  fileReadCounts: Map<string, number>;
  fileEditCounts: Map<string, number>;
  consecutiveSameFileOps: number;
  lastOperatedFile: string | null;
  phase: "orient" | "read" | "edit" | "verify";
}

/**
 * Runs when LLM stops calling tools. Returns null if task is complete,
 * or a blocking error message that gets injected back into the conversation.
 */
export function runStopHook(loopState: LoopState, userInstruction: string): string | null {
  if (!loopState.hasSearched && !loopState.hasEdited) {
    const keywords = userInstruction
      .replace(/[，。！？、\s]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    const keywordList = keywords.map((k) => `"${k}"`).join(", ");

    return `You stopped without using any tools. This is not allowed.

You MUST search the codebase first. The user said: "${userInstruction}"

Try these steps NOW:
1. Call list_dir with path "components/sections" to see all section files
2. Call search_code with keywords from the user's instruction: ${keywordList}
3. If Chinese keywords don't match, try English equivalents (e.g. 性能→Performance, 导航→Nav, 标题→title/heading)

Do NOT respond with text only. Use tools.`;
  }
  if (!loopState.hasEdited) {
    return `You searched but didn't make any changes. The user asked you to modify something.

If you found the relevant files, read them and make the edits now.
If you're unsure which component the user means, explain what you found and ask a specific question — but include the file names you discovered so the user can point you to the right one.

Do not give up without explaining your search results.`;
  }
  if (!loopState.hasBuild) {
    return "You've made changes but haven't verified them. Please call run_build to check that the project still compiles.";
  }
  if (!loopState.buildPassed) {
    const totalEdits = Array.from(loopState.fileEditCounts.values()).reduce((a, b) => a + b, 0);
    if (totalEdits > 6) {
      return `The build is still failing after ${totalEdits} edits. You may be fixing symptoms, not the root cause.

STOP and use the "think" tool to analyze:
1. Re-read the build error carefully — what is the ACTUAL root cause?
2. Are you editing the right file? Maybe the issue is in a parent component, layout, or CSS.
3. Consider using revert_file to undo your changes and take a completely different approach.

Build output:
\`\`\`
${loopState.lastBuildOutput.slice(0, 2000)}
\`\`\``;
    }
    return `The build failed after your changes:\n\`\`\`\n${loopState.lastBuildOutput.slice(0, 2000)}\n\`\`\`\nPlease fix the errors using edit_file and run_build again.`;
  }
  return null;
}
