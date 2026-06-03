import {
  USER_PROVIDED_CONTENT_PATH,
  writeUserProvidedContentText,
} from "@/lib/content/userProvidedContentText";
import { composePromptBlocks, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithTools } from "../shared/llm";
import { buildUserVisionContent, visionTraceUserLabel } from "../shared/userVisionContent";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import { hasUserProvidedContent } from "../schema/normalizeUserProvidedContent";
import type { StepTrace, UserProvidedContent } from "../types";
import {
  buildContentFromAccumulator,
  createUserProvidedContentAccumulator,
  createUserProvidedContentToolExecutors,
  userProvidedContentExtractionTools,
} from "../tools/userProvidedContentTools";

/**
 * Organize the user query into categories and write content/user-provided.md.
 * Image URLs are kept remote — Page Agent uses them directly (no server download).
 */
export async function stepExtractUserProvidedContent(params: {
  userInput: string;
  referenceImageBase64?: string | null;
}): Promise<{ content: UserProvidedContent | undefined; trace: StepTrace }> {
  const acc = createUserProvidedContentAccumulator();
  const executors = createUserProvidedContentToolExecutors(acc);
  const model = getModelForStep("extract_user_provided_content");

  const systemPrompt = composePromptBlocks([loadStepPrompt("extractUserProvidedContent")]);
  const userMessage = `## User message\n\n${params.userInput}`;
  const userContent = buildUserVisionContent(userMessage, params.referenceImageBase64 ?? null);
  const traceUserLabel = visionTraceUserLabel(userMessage, Boolean(params.referenceImageBase64?.trim()));

  const { content: assistantSummary, toolCalls } = await callLLMWithTools({
    systemPrompt,
    userMessage,
    userContent,
    tools: userProvidedContentExtractionTools,
    temperature: 0.15,
    maxIterations: 32,
    maxTokens: 8_192,
    parallelToolCalls: false,
    model,
    executeToolOverrides: executors,
    langfusePhase: LfToolPhase.extractUserProvidedContent,
  });

  const content = buildContentFromAccumulator(acc);

  if (content?.images?.length) {
    console.log(`[extract_user_provided_content] ${content.images.length} image URL(s) recorded:`);
    content.images.forEach((img, i) => {
      console.log(`  ${i + 1}. (${img.url.length} chars) ${img.url}`);
    });
  }

  if (content && hasUserProvidedContent(content)) {
    await writeUserProvidedContentText(writeSiteFile, content);
  }

  return {
    content,
    trace: {
      input: { userInputLength: params.userInput.length },
      output: {
        toolCalls: toolCalls.length,
        imageCount: content?.images?.length ?? 0,
        wroteFile: Boolean(content && hasUserProvidedContent(content)),
        file: USER_PROVIDED_CONTENT_PATH,
      },
      llmCall: {
        model,
        userMessage: traceUserLabel,
        rawResponse: assistantSummary,
      },
    },
  };
}
