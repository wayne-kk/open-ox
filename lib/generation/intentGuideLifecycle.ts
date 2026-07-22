export function shouldEnableIntentGuideForGeneration(input: {
  retryProjectId?: string;
  requested?: boolean;
}): boolean {
  return !input.retryProjectId && input.requested !== false;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface StoredGenerationRunPrompt {
  enableIntentGuide?: unknown;
  effectivePrompt?: unknown;
}

export function selectPreviousCommittedGenerationPrompt(
  payloads: StoredGenerationRunPrompt[],
): string | undefined {
  const committed = payloads.find(
    (payload) =>
      payload.enableIntentGuide === false &&
      nonEmptyString(payload.effectivePrompt),
  );
  if (committed) return nonEmptyString(committed.effectivePrompt);
  return undefined;
}

export function selectEffectiveGenerationPrompt(input: {
  retryProjectId?: string;
  requestPrompt?: unknown;
  previousRunPrompt?: unknown;
  projectPrompt?: unknown;
}): string | undefined {
  const requestPrompt = nonEmptyString(input.requestPrompt);
  const projectPrompt = nonEmptyString(input.projectPrompt);
  if (!input.retryProjectId) return requestPrompt ?? projectPrompt;
  return (
    requestPrompt ??
    nonEmptyString(input.previousRunPrompt) ??
    projectPrompt
  );
}

interface GenerationRunCompletionInput {
  success: boolean;
  error?: string;
  intentGuideDeferred?: boolean;
  intentGuide?: unknown;
}

export type GenerationRunCompletion =
  | {
      kind: "ready";
      projectStatus: "ready";
      runStatus: "succeeded";
      runError: null;
    }
  | {
      kind: "awaiting_input";
      projectStatus: "awaiting_input";
      runStatus: "succeeded";
      runError: null;
    }
  | {
      kind: "failed";
      projectStatus: "failed";
      runStatus: "failed";
      runError: string;
    };

export function classifyGenerationRunCompletion(
  result: GenerationRunCompletionInput,
): GenerationRunCompletion {
  if (result.success) {
    return {
      kind: "ready",
      projectStatus: "ready",
      runStatus: "succeeded",
      runError: null,
    };
  }
  if (result.intentGuideDeferred && result.intentGuide) {
    return {
      kind: "awaiting_input",
      projectStatus: "awaiting_input",
      runStatus: "succeeded",
      runError: null,
    };
  }
  return {
    kind: "failed",
    projectStatus: "failed",
    runStatus: "failed",
    runError: result.error ?? "Generation failed",
  };
}
