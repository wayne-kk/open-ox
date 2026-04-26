import { composePromptBlocks, loadStepPrompt } from "../shared/files";
import { callLLMWithMeta } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { writeSiteFile } from "../shared/files";
import type { StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

export interface DesignIntentResult {
  /** Full markdown text — visual blueprint for downstream design system generation */
  text: string;
  /**
   * Keywords parsed from the `- Keywords:` line in design-intent markdown
   * (see inferDesignIntent step prompt). No hardcoded term lists — empty if missing.
   */
  technicalKeywords: string[];
  /** LLM I/O for Studio step detail (omitted when step is skipped or fails before LLM) */
  trace?: StepTrace;
}

/**
 * Parse `- Keywords:` from design-intent markdown (format enforced by inferDesignIntent prompt).
 * Splits on common separators only — no domain synonym lists or regex vocabularies.
 */
function parseKeywordsLine(markdown: string): string[] {
  const keywordsMatch = markdown.match(/^-\s*Keywords?:\s*(.+)$/im);
  if (!keywordsMatch) return [];

  const raw = keywordsMatch[1].trim();
  const parts = raw.split(/[,，、]\s*/);
  const out = parts
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  return [...new Set(out)];
}

/**
 * Infer design intent from user input.
 * Returns a markdown text (not JSON) that serves as the visual blueprint
 * for downstream design system generation, plus keywords parsed from the
 * `- Keywords:` line for skill matching (model output only).
 * Also saves the output as design-intent.md in the project directory.
 */
export async function stepInferDesignIntent(
  userInput: string
): Promise<DesignIntentResult> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("inferDesignIntent"),
  ]);

  const userMessage = `## User Requirement
${userInput}`;

  const model = getModelForStep("infer_design_intent");

  try {
    const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.4, undefined, model);
    const text = meta.content.trim();
    const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
    if (text) {
      await writeSiteFile("design-intent.md", text);
    }
    const technicalKeywords = parseKeywordsLine(text);
    return { text, technicalKeywords, trace };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: "",
      technicalKeywords: [],
      trace: {
        llmCall: {
          model,
          systemPrompt,
          userMessage,
          rawResponse: `[infer_design_intent failed]\n${message}`,
        },
      },
    };
  }
}
