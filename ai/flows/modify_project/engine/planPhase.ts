import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";

export type ModifyPlan = {
  summary: string;
  targetFiles: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseModifyPlanPayload(parsed: unknown): ModifyPlan {
  const root = isRecord(parsed) ? parsed : {};
  const summary = typeof root.summary === "string" ? root.summary.trim() : "";
  const rawTargets = Array.isArray(root.targetFiles) ? root.targetFiles : [];
  const targetFiles = rawTargets
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.replace(/\\/g, "/").replace(/^(\.\/)+/, ""));
  return { summary, targetFiles: [...new Set(targetFiles)].slice(0, 12) };
}

/**
 * Single planning LLM call for broad modifications — avoids 20+ exploratory tool rounds.
 */
export async function runModifyPlanPhase(input: {
  userInstruction: string;
  fileTree: string;
  preloadedFiles: Array<{ path: string; content: string }>;
}): Promise<ModifyPlan> {
  const model = getModelForStep("modify_plan");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("modifyPlan"),
    loadGuardrail("outputJson"),
  ]);

  const preloadBlock =
    input.preloadedFiles.length > 0
      ? `\n## Preloaded file excerpts\n${input.preloadedFiles
          .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
          .join("\n\n")}\n`
      : "";

  const userPayload = `## User instruction\n${input.userInstruction}\n\n## File tree\n\`\`\`\n${input.fileTree}\n\`\`\`${preloadBlock}`;

  const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.2, undefined, model, {
    langfuseName: lfPlain(LfPlain.modifyPlan),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(meta.content));
  } catch {
    return {
      summary: meta.content.slice(0, 500) || input.userInstruction,
      targetFiles: input.preloadedFiles.map((f) => f.path).slice(0, 6),
    };
  }

  return parseModifyPlanPayload(parsed);
}
