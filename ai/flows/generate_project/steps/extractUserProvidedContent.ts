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
import { seedUserProvidedImagesFromTexts } from "../shared/seedUserProvidedImagesFromPrompt";

/**
 * Organize the user query into categories and write content/user-provided.md.
 * Image URLs are kept remote — Page Agent uses them directly (no server download).
 */
export async function stepExtractUserProvidedContent(params: {
  userInput: string;
  /** Original/bootstrap/intent-session texts — scanned for image URLs alongside `userInput`. */
  imageSourceTexts?: string[];
  referenceImageBase64?: string | null;
}): Promise<{ content: UserProvidedContent | undefined; trace: StepTrace }> {
  const acc = createUserProvidedContentAccumulator();
  const scanTexts = [params.userInput, ...(params.imageSourceTexts ?? [])].filter((t) => t.trim());
  const seedResult = seedUserProvidedImagesFromTexts(acc.images, scanTexts);
  acc.images = seedResult.images;
  const imagesFromPromptScan = acc.images.length;

  const executors = createUserProvidedContentToolExecutors(acc);
  const model = getModelForStep("extract_user_provided_content");

  const systemPrompt = composePromptBlocks([loadStepPrompt("extractUserProvidedContent")]);
  const preseedNote =
    imagesFromPromptScan > 0
      ? `\n\n## Pre-scanned images\n\n${imagesFromPromptScan} Google image URL(s) already registered from your message. ` +
        `Use \`add_user_provided_image\` only to add **caption/role** or to register URLs that were missed.\n`
      : "";
  const userMessage = `## User message\n\n${params.userInput}${preseedNote}`;
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
  const finalImageCount = content?.images?.length ?? 0;

  if (finalImageCount > 0) {
    console.log(
      `[extract_user_provided_content] ${finalImageCount} image URL(s) ` +
        `(prompt_scan=${imagesFromPromptScan}, after_llm=${finalImageCount})`
    );
    content!.images!.forEach((img, i) => {
      console.log(`  ${i + 1}. (${img.url.length} chars) ${img.url}`);
    });
  }

  if (content && hasUserProvidedContent(content)) {
    await writeUserProvidedContentText(writeSiteFile, content);
  }

  return {
    content,
    trace: {
      input: {
        userInputLength: params.userInput.length,
        imageSourceTextCount: params.imageSourceTexts?.length ?? 0,
      },
      output: {
        toolCalls: toolCalls.length,
        imageCount: finalImageCount,
        imagesFromPromptScan,
        imagesAddedByLlm: Math.max(0, finalImageCount - imagesFromPromptScan),
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
