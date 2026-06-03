import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLMWithTools, extractJSON } from "../shared/llm";
import { buildUserVisionContent, visionTraceUserLabel } from "../shared/userVisionContent";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import { webSearchTool, executeWebSearch } from "../../../tools/system/webSearchTool";
import {
  fetchReferencePageTool,
  executeFetchReferencePage,
} from "../../../tools/system/fetchReferencePageTool";
import {
  referenceSiteDigestTool,
  executeReferenceSiteDigest,
} from "../../../tools/system/referenceSiteDigestTool";
import type { ProjectBlueprint, StepTrace } from "../types";
import { asProjectBlueprint } from "../schema/normalizeBlueprint";
import { detectBlueprintInputShape, warnOnBlueprintFallback } from "../schema/projectBlueprint.schema";
import { getModelForStep } from "@/lib/config/models";

export async function stepAnalyzeProjectRequirement(
  userInput: string,
  onToolCall?: (name: string, args: Record<string, unknown>, result: string) => void,
  options?: {
    referenceImageBase64?: string | null;
    /** When set with a reference image, selects screenshot handling rule (replicate vs extract). */
    screenshotGuardrailId?: string | null;
  }
): Promise<{ blueprint: ProjectBlueprint; trace: StepTrace }> {
  const hasRef = Boolean(options?.referenceImageBase64?.trim());
  const screenshotGr =
    hasRef && options?.screenshotGuardrailId?.trim()
      ? options.screenshotGuardrailId.trim()
      : hasRef
        ? "screenshotLayoutFidelity"
        : null;
  const model = getModelForStep("analyze_project_requirement");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("analyzeProjectRequirement"),
    ...(screenshotGr ? [loadGuardrail(screenshotGr)] : []),
  ]);

  const userContent = buildUserVisionContent(userInput, options?.referenceImageBase64 ?? null);
  const traceUserLabel = visionTraceUserLabel(userInput, hasRef);

  const { content: raw, toolCalls } = await callLLMWithTools({
    systemPrompt,
    userMessage: userInput,
    userContent,
    tools: [referenceSiteDigestTool, fetchReferencePageTool, webSearchTool],
    temperature: 0.5,
    maxIterations: 8,
    maxTokens: userInput.length > 2000 ? 16_384 : 8_192,
    model,
    executeToolOverrides: {
      fetch_reference_page: executeFetchReferencePage,
      reference_site_digest: executeReferenceSiteDigest,
      web_search: executeWebSearch,
    },
    langfusePhase: LfToolPhase.analyzeRequirement,
  });

  for (const tc of toolCalls) {
    const resultStr = typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result);
    onToolCall?.(tc.name, tc.args, resultStr);
  }

  const jsonStr = extractJSON(raw);

  try {
    const parsed = JSON.parse(jsonStr);
    const shape = detectBlueprintInputShape(parsed);
    warnOnBlueprintFallback(shape);
    const blueprint = asProjectBlueprint(parsed);
    blueprint.brief.language =
      typeof blueprint.brief.language === "string" && blueprint.brief.language.trim()
        ? blueprint.brief.language.trim()
        : "en";
    const trace: StepTrace = {
      llmCall: {
        model,
        systemPrompt,
        userMessage: traceUserLabel,
        rawResponse: raw,
      },
      output: {
        toolCalls: toolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args,
          resultPreview: typeof tc.result === "string" ? tc.result.slice(0, 4000) : JSON.stringify(tc.result).slice(0, 4000),
        })),
      },
    };

    return { blueprint, trace };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("analyze_project_requirement:")) {
      throw new Error(`${error.message}\nRaw output:\n${raw}`);
    }

    throw new Error(
      `analyze_project_requirement: failed to parse ProjectBlueprint JSON.\nRaw output:\n${raw}`
    );
  }
}
