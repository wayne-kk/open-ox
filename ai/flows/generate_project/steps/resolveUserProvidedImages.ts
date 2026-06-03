import { writeSiteFile } from "../shared/files";
import type { StepTrace, UserProvidedContent } from "../types";
import { hasUserProvidedContent } from "../schema/normalizeUserProvidedContent";
import { resolveUserProvidedImages } from "@/lib/content/resolveUserProvidedImages";
import { writeUserProvidedContentText } from "@/lib/content/userProvidedContentText";

/**
 * Pipeline step: download user image URLs only (no generate).
 * Rewrites content/user-provided.md with paths for successful downloads.
 */
export async function stepResolveUserProvidedImages(params: {
  content: UserProvidedContent | undefined;
}): Promise<{
  content: UserProvidedContent | undefined;
  trace: StepTrace;
}> {
  const images = params.content?.images ?? [];
  if (!hasUserProvidedContent(params.content) || !params.content || images.length === 0) {
    return {
      content: params.content,
      trace: {
        input: { skipped: true, imageCount: images.length },
        output: {},
        llmCall: undefined,
      },
    };
  }

  const { content, stats } = await resolveUserProvidedImages(params.content);

  await writeUserProvidedContentText(writeSiteFile, content);

  return {
    content,
    trace: {
      input: {
        imageCount: images.length,
        urls: images.map((img, index) => ({ index, url: img.url, urlLength: img.url.length })),
      },
      output: { stats },
      llmCall: undefined,
    },
  };
}
