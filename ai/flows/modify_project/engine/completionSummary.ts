import type { ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import { composePromptBlocks, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import type { DiffStats } from "../tracking/fileSnapshotTracker";

export type ModifySummaryDiff = {
  file: string;
  stats: DiffStats;
};

export type ModifyCompletionSummaryInput = {
  userInstruction: string;
  modifyMode: "code_change" | "read_only";
  diffs: ModifySummaryDiff[];
  iterations: number;
  buildPassed: boolean;
  buildSkipped: boolean;
  assistantNotes?: string;
};

export function extractLastAssistantMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    if (typeof message.content !== "string") continue;
    const text = message.content.trim();
    if (text) return text;
  }
  return "";
}

export function formatModifySummaryFallback(input: ModifyCompletionSummaryInput): string {
  const { diffs, modifyMode, buildPassed, buildSkipped, assistantNotes } = input;

  if (diffs.length === 0) {
    const notes = assistantNotes?.trim();
    if (notes) return notes.slice(0, 4000);
    if (modifyMode === "read_only") {
      return "已完成回答。如需继续了解其他文件或模块，可以直接说明。";
    }
    return "本次未产生文件变更。若仍有需求，请补充具体文件或期望效果。";
  }

  const fileLines = diffs.slice(0, 8).map(
    (d) => `- \`${d.file}\`（+${d.stats.additions} / −${d.stats.deletions}）`
  );
  const more =
    diffs.length > 8 ? `\n- … 另有 ${diffs.length - 8} 个文件` : "";

  const verificationLine = buildSkipped
    ? ""
    : buildPassed
      ? "\n\n✅ **构建验证已通过**，可在预览中查看效果。"
      : "\n\n⚠️ **构建验证未通过**，请查看执行日志或说明要修复的问题。";

  return [
    `已更新 ${diffs.length} 个文件。`,
    "",
    "### 修改完成",
    "",
    `已更新 **${diffs.length}** 个文件：`,
    "",
    ...fileLines,
    more,
    verificationLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSummaryUserPayload(input: ModifyCompletionSummaryInput): string {
  const diffBlock =
    input.diffs.length > 0
      ? input.diffs
          .map((d) => `- ${d.file} (+${d.stats.additions}/-${d.stats.deletions})`)
          .join("\n")
      : "(none)";

  const verification = input.buildSkipped
    ? "skipped"
    : input.buildPassed
      ? "passed"
      : "failed";

  const notes = input.assistantNotes?.trim().slice(0, 2500);

  return [
    "## User request",
    input.userInstruction.trim(),
    "",
    "## Execution",
    `- Mode: ${input.modifyMode}`,
    `- Agent iterations: ${input.iterations}`,
    `- Build verification: ${verification}`,
    "",
    "## Changed files",
    diffBlock,
    notes ? `\n## Agent closing notes (reference only)\n${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runModifyCompletionSummary(
  input: ModifyCompletionSummaryInput
): Promise<string> {
  const fallback = formatModifySummaryFallback(input);

  if (input.modifyMode === "read_only" && input.diffs.length === 0 && input.assistantNotes?.trim()) {
    return input.assistantNotes.trim().slice(0, 4000);
  }

  try {
    const model = getModelForStep("modify_summary");
    const systemPrompt = composePromptBlocks([loadStepPrompt("modifyCompletionSummary")]);
    const meta = await callLLMWithMeta(
      systemPrompt,
      buildSummaryUserPayload(input),
      0.25,
      undefined,
      model,
      { langfuseName: lfPlain(LfPlain.modifyCompletionSummary) }
    );
    const summary = meta.content.trim();
    return summary.length >= 20 ? summary : fallback;
  } catch {
    return fallback;
  }
}
