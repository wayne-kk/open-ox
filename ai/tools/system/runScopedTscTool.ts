import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolExecutor } from "../types";
import { runScopedTypecheck } from "@/ai/flows/modify_project/engine/verification";

export const runScopedTscTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_scoped_tsc",
    description:
      "Run a fast scoped TypeScript check on files touched in this modify session. " +
      "Prefer fixing inline errors from edit_file first; use this before finishing a large batch of edits.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

/** Placeholder — modify loop uses profiled executor with session touched-file set. */
export const executeRunScopedTsc: ToolExecutor = async () => ({
  success: false,
  error: "run_scoped_tsc must be invoked from the modify agent loop (session context missing).",
});

export async function executeRunScopedTscOnFiles(
  touchedFiles: string[]
): Promise<{ success: boolean; output: string }> {
  const result = await runScopedTypecheck(touchedFiles);
  return { success: result.passed, output: result.output };
}
