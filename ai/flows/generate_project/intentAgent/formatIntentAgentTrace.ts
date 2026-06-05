import type { IntentAgentTraceStep } from "./types";

export function formatIntentAgentTraceSummary(trace: IntentAgentTraceStep[] | undefined): string {
  if (!trace?.length) return "";
  const lines: string[] = [];
  for (const step of trace) {
    if (step.kind === "llm_round") {
      const tools =
        step.toolCallNames.length > 0 ? step.toolCallNames.join(", ") : "(无工具，直接回复)";
      lines.push(`LLM 第 ${step.iteration + 1} 轮 → ${tools}`);
    } else {
      lines.push(`  └ ${step.toolName} ${step.durationMs}ms`);
    }
  }
  return lines.join("\n");
}
