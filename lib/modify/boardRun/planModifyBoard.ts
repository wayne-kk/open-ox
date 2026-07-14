import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import {
  AdvanceBoardRunError,
  BOARD_RUN_MAX_TASKS,
  type BoardTaskInput,
} from "./boardRunTypes";

export type ModifyBoardPlan = {
  tasks: BoardTaskInput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Pure parse + validate — secondary test seam for board planner. */
export function parseModifyBoardPlan(parsed: unknown): ModifyBoardPlan {
  const root = isRecord(parsed) ? parsed : {};
  const rawTasks = Array.isArray(root.tasks) ? root.tasks : [];
  const tasks: BoardTaskInput[] = [];

  for (const item of rawTasks) {
    if (!isRecord(item)) continue;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const instruction =
      typeof item.instruction === "string" ? item.instruction.trim() : "";
    if (!title || !instruction) continue;
    tasks.push({ title, instruction });
  }

  if (tasks.length === 0) {
    throw new AdvanceBoardRunError("empty_tasks", "Board planner returned no valid tasks");
  }
  if (tasks.length > BOARD_RUN_MAX_TASKS) {
    throw new AdvanceBoardRunError(
      "too_many_tasks",
      `Board planner returned more than ${BOARD_RUN_MAX_TASKS} tasks`
    );
  }
  if (tasks.length < 2) {
    throw new AdvanceBoardRunError(
      "empty_tasks",
      "Board planner must return at least 2 tasks for a board"
    );
  }

  return { tasks };
}

/**
 * Dedicated board planner — user-language cards (title + Modify instruction).
 * Caller persists via advanceBoardRun(propose); does not run Modify.
 */
export async function stepPlanModifyBoard(
  userInstruction: string,
  options?: { fileTree?: string }
): Promise<ModifyBoardPlan> {
  const trimmed = userInstruction.trim();
  if (!trimmed) {
    throw new AdvanceBoardRunError("empty_tasks", "Empty instruction cannot be planned");
  }

  const model = getModelForStep("modify_board_planner");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("modifyBoardPlanner"),
    loadGuardrail("outputJson"),
  ]);

  const userPayload = [
    trimmed,
    options?.fileTree?.trim()
      ? `\n## Project file tree (optional context)\n\`\`\`\n${options.fileTree.trim()}\n\`\`\``
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.35, undefined, model, {
    langfuseName: lfPlain(LfPlain.modifyBoardPlanner),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(meta.content));
  } catch {
    throw new Error(
      `modify_board_planner: failed to parse JSON.\nRaw output:\n${meta.content.slice(0, 4000)}`
    );
  }

  return parseModifyBoardPlan(parsed);
}
