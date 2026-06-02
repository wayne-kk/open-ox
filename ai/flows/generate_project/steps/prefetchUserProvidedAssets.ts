import { writeSiteFile } from "../shared/files";
import type { UserProvidedContent } from "../types";
import {
  prefetchUserProvidedAssets,
} from "@/lib/content/userProvidedContentPipeline";
import { hasUserProvidedContent } from "../schema/normalizeUserProvidedContent";
import type { StepTrace } from "../types";

export async function stepPrefetchUserProvidedAssets(params: {
  content: UserProvidedContent | undefined;
  userInput: string;
}): Promise<{
  content: UserProvidedContent | undefined;
  trace: StepTrace;
}> {
  const result = await prefetchUserProvidedAssets({
    content: params.content,
    userInput: params.userInput,
  });

  if (result.content && hasUserProvidedContent(result.content)) {
    await writeSiteFile(
      "content/user-provided.json",
      `${JSON.stringify(result.content, null, 2)}\n`
    );
  }

  const { stats } = result;
  const detail =
    stats.imageTotal > 0
      ? `${stats.downloaded} downloaded, ${stats.generated} generated, ${stats.failed} failed (${stats.imageTotal} total)`
      : "no user-provided assets to prefetch";

  return {
    content: result.content,
    trace: {
      input: {
        hadExtractedContent: Boolean(params.content),
        userInputLength: params.userInput.length,
      },
      output: { stats, wroteJson: Boolean(result.content) },
      llmCall: undefined,
    },
  };
}
