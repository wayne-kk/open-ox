import type { ModifyIntentCategory } from "@/ai/flows/modify_project/intent/modifyIntentRouter";
import type { ModifyScope } from "@/ai/flows/modify_project/intent/modifyIntentRouter";

/** Whether Modify should stop after proposing a BoardRun (no agent loop). */
export function shouldSuggestModifyBoard(
  routed: { category: ModifyIntentCategory; scope: ModifyScope },
  opts: {
    forceBoard?: boolean;
    forceSingleModify?: boolean;
    /** Studio opt-in for automatic broad → board. Headless/Feishu leave false. */
    preferBoardSuggest?: boolean;
  } = {}
): boolean {
  if (opts.forceSingleModify) return false;
  if (opts.forceBoard) return true;
  if (!opts.preferBoardSuggest) return false;
  return routed.category === "code_change" && routed.scope === "broad";
}
