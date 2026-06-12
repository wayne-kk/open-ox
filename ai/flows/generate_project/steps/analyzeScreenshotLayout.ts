import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMetaUserContent, extractJSON } from "../shared/llm";
import { buildUserVisionContent, visionTraceUserLabel } from "../shared/userVisionContent";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { getModelForStep } from "@/lib/config/models";
import {
  normalizePageSpec,
  pageSpecSectionsToPlannedSections,
  type PageSpec,
} from "../schema/pageSpec";
import type { PlannedPageBlueprint, PlannedSectionSpec, StepTrace } from "../types";

export const ANALYZE_SCREENSHOT_LAYOUT_STEP = "analyze_screenshot_layout";

export interface AnalyzeScreenshotLayoutParams {
  userInput: string;
  referenceScreenshotDataUrl: string;
  page: PlannedPageBlueprint;
}

export interface AnalyzeScreenshotLayoutResult {
  pageSpec: PageSpec;
  sections: PlannedSectionSpec[];
  trace: StepTrace;
}

export async function stepAnalyzeScreenshotLayout(
  params: AnalyzeScreenshotLayoutParams
): Promise<AnalyzeScreenshotLayoutResult> {
  const { userInput, referenceScreenshotDataUrl, page } = params;
  const model = getModelForStep(ANALYZE_SCREENSHOT_LAYOUT_STEP);

  const systemPrompt = composePromptBlocks([
    loadStepPrompt("analyzeScreenshotLayout"),
    loadGuardrail("screenshotLayoutFidelity"),
    loadGuardrail("outputJson"),
  ]);

  const userMessage = `## Page context
- Slug: ${page.slug}
- Title: ${page.title}
- Description: ${page.description}

## User brief (text)
${userInput.trim() || "（无额外文字，请仅从截图推断结构）"}

Analyze the attached screenshot and output PageSpec JSON for the **page content sections only**.`;

  const userContent = buildUserVisionContent(userMessage, referenceScreenshotDataUrl);
  const traceUserLabel = visionTraceUserLabel(userMessage, true);

  const meta = await callLLMWithMetaUserContent(
    systemPrompt,
    userContent,
    0.2,
    12_288,
    model,
    { langfuseName: lfPlain(LfPlain.analyzeScreenshotLayout) }
  );

  const pageSpec = normalizePageSpec(JSON.parse(extractJSON(meta.content)));
  const sections = pageSpecSectionsToPlannedSections(pageSpec.sections);

  await writeSiteFile("screenshot-page-spec.json", JSON.stringify(pageSpec, null, 2));

  const trace = stepTraceFromLlmCompletion(systemPrompt, traceUserLabel, meta);

  return { pageSpec, sections, trace };
}
