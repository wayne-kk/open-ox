import {
  loadStepPrompt,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLMWithMeta, extractContent, extractJSON } from "../shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type { StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

function looksLikeGlobalsCss(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  return (
    /@import|@theme|@layer|@tailwindcss|@keyframes/.test(t) ||
    (t.includes("{") && t.includes("}") && /:\s*root|--color-|--font-/.test(t))
  );
}

function parseDesignTokensResponse(raw: string): string {
  const trimmed = raw.trim();

  const fromCssFence = extractContent(trimmed, "css");
  if (looksLikeGlobalsCss(fromCssFence)) return fromCssFence.trim();

  const anyFence = extractContent(trimmed, "");
  if (anyFence !== trimmed && looksLikeGlobalsCss(anyFence)) return anyFence.trim();

  if (looksLikeGlobalsCss(trimmed)) return trimmed;

  try {
    const jsonStr = extractJSON(trimmed);
    const parsed = JSON.parse(jsonStr) as { globals_css?: unknown };
    if (typeof parsed.globals_css === "string" && parsed.globals_css.trim().length > 0) {
      return parsed.globals_css.trim();
    }
  } catch { /* fall through */ }

  const preview = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  throw new Error(
    `apply_project_design_tokens: could not parse model output as CSS or JSON.\nPreview:\n${preview}`
  );
}

function truncateForPrompt(text: string, maxChars = 12_000): string {
  if (text.length <= maxChars) return text;
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = maxChars - headChars;
  return [
    text.slice(0, headChars),
    "",
    `/* ... truncated ${text.length - maxChars} chars to reduce LLM latency ... */`,
    "",
    text.slice(-tailChars),
  ].join("\n");
}

export interface ApplyDesignTokensOptions {
  onProgress?: (msg: string) => void;
}

/**
 * Apply the design-system markdown to the site by asking the model to produce
 * a full `app/globals.css`. Inputs are only the design-system text and the
 * current template globals (structure to preserve); no other skill files are read.
 *
 * Intentionally does **not** pass `max_tokens` / `max_completion_tokens` so the
 * upstream uses its own defaults (experiment: Gemini lite/preview paths were hitting
 * `finish_reason=length` with empty `content` despite large client-side caps).
 */
function truncateDesignSystemMarkdown(text: string, maxChars = 48_000): string {
  if (text.length <= maxChars) return text;
  const headChars = Math.floor(maxChars * 0.72);
  const tailChars = maxChars - headChars;
  return [
    text.slice(0, headChars),
    "",
    `… [design system truncated middle: ${text.length - maxChars} chars omitted for prompt budget]`,
    "",
    text.slice(-tailChars),
  ].join("\n");
}

export async function stepApplyProjectDesignTokens(
  designSystem: string,
  options: ApplyDesignTokensOptions = {},
): Promise<{ files: string[]; trace: StepTrace }> {
  const { onProgress } = options;

  const currentGlobalsCss = readSiteFile("app/globals.css");

  onProgress?.("reading design system + current tokens...");

  const systemPrompt = loadStepPrompt("applyProjectDesignTokens");

  const designForPrompt = truncateDesignSystemMarkdown(designSystem.trim());

  const userMessage = `## Design System
${designForPrompt}

## Current globals.css structure (for reference — preserve imports, base styles, scrollbar styles)
\`\`\`css
${truncateForPrompt(currentGlobalsCss)}
\`\`\`

Generate the complete updated globals.css. Be concise — output only the CSS code block, no explanation.`;

  const stepModel = getModelForStep("apply_project_design_tokens");
  onProgress?.(
    `calling LLM (${stepModel}) to generate design tokens (no client max_tokens cap — upstream default)...`
  );
  const t0 = Date.now();
  let heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
    const waitingSec = Math.floor((Date.now() - t0) / 1000);
    onProgress?.(`waiting for model response... ${waitingSec}s`);
  }, 10_000);

  let raw = "";
  let globalsCss = "";
  let llmResultForTrace: Awaited<ReturnType<typeof callLLMWithMeta>> | null = null;
  let tokenUsage: { input?: number; output?: number } = {};
  try {
    const maxAttempts = 4;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        onProgress?.(`apply_project_design_tokens: retry ${attempt + 1}/${maxAttempts}`);
      }

      try {
        const llmResult = await callLLMWithMeta(
          systemPrompt,
          userMessage,
          0.3,
          undefined,
          stepModel,
          { langfuseName: lfPlain(LfPlain.applyDesignTokens) }
        );
        llmResultForTrace = llmResult;
        raw = llmResult.content;
        tokenUsage = {
          input: llmResult.inputTokens,
          output: llmResult.outputTokens,
        };

        globalsCss = parseDesignTokensResponse(raw);
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const retryable =
          msg.includes("truncated") ||
          msg.includes("output limit") ||
          msg.includes("max_tokens") ||
          msg.includes("could not parse model output");

        if (!retryable || attempt === maxAttempts - 1) {
          throw err;
        }
      }
    }
    void lastError;
    if (!globalsCss.trim()) {
      throw new Error(
        `apply_project_design_tokens: incomplete after retries (last raw length=${raw.length})`
      );
    }
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  onProgress?.(
    `LLM finished in ${elapsed}s (${stepModel}, in=${tokenUsage.input ?? "?"}, out=${tokenUsage.output ?? "?"}); writing globals.css (${globalsCss.length} chars)...`
  );

  await writeSiteFile("app/globals.css", globalsCss);

  const trace =
    llmResultForTrace != null
      ? stepTraceFromLlmCompletion(systemPrompt, userMessage, llmResultForTrace)
      : ({
          llmCall: {
            model: stepModel,
            systemPrompt,
            userMessage,
            rawResponse: "[apply_project_design_tokens: no LLM result captured]",
          },
        } satisfies StepTrace);

  return { files: ["app/globals.css"], trace };
}
