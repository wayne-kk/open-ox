import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLMWithTools, extractJSON } from "../shared/llm";
import { webSearchTool, executeWebSearch } from "../../../tools/system/webSearchTool";
import type { ProjectBlueprint } from "../types";
import { asProjectBlueprint } from "../schema/normalizeBlueprint";
import { detectBlueprintInputShape, warnOnBlueprintFallback } from "../schema/projectBlueprint.schema";

export async function stepAnalyzeProjectRequirement(
  userInput: string,
  onToolCall?: (name: string, args: Record<string, unknown>, result: string) => void
): Promise<ProjectBlueprint> {
  const systemPrompt = composePromptBlocks([
    `You are a senior product strategist and MVP architect.

Before analyzing the user's request, check if it contains any proper nouns, brand names, people, products, or domain-specific terms you are unfamiliar with.
If so, use the web_search tool to look them up first, then proceed with the analysis.

After gathering any needed context, produce a structured ProjectBlueprint JSON.`,
    loadStepPrompt("analyzeProjectRequirement"),
    loadGuardrail("outputJson"),
  ]);

  const { content: raw, toolCalls } = await callLLMWithTools({
    systemPrompt,
    userMessage: userInput,
    tools: [webSearchTool],
    temperature: 0.5,
    maxIterations: 4,
    executeToolOverrides: { web_search: executeWebSearch },
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
    return blueprint;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("analyze_project_requirement:")) {
      throw new Error(`${error.message}\nRaw output:\n${raw}`);
    }

    throw new Error(
      `analyze_project_requirement: failed to parse ProjectBlueprint JSON.\nRaw output:\n${raw}`
    );
  }
}
