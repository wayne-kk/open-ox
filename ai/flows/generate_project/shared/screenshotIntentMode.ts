import type { ScreenshotIntentMode } from "../types";

const EXTRACT_PATTERNS: RegExp[] = [
  /\b(?:参考|借鉴|提取|灵感|气质|风格类似|大致|差不多就行|不必(?:完全)?一致|不要(?:完全)?一样|loosely|inspired by)\b/i,
  /\b(?:只要|主要)(?:文案|配色|token|色值|字体)/i,
  /(?:参考|借鉴).{0,6}(?:风格|配色|文案|布局感受)/i,
];

const REPLICATE_PATTERNS: RegExp[] = [
  /\b(?:复刻|还原|高保真|一比一|1:1|按图|对着图|严格(?:对照|按)|像素级|一模一样|wireframe|mockup)\b/i,
  /\b(?:尽量|需要).{0,4}(?:一致|相同|还原)/i,
];

/**
 * @param userInput effective prompt (e.g. merged brief + original context)
 * @param hasReferenceImage whether a screenshot is passed into the generate pipeline
 */
export function resolveScreenshotIntentMode(
  userInput: string,
  hasReferenceImage: boolean
): ScreenshotIntentMode {
  if (!hasReferenceImage) return "none";
  const t = userInput.trim();
  if (!t) return "replicate_layout";

  const extractScore = EXTRACT_PATTERNS.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  const replicateScore = REPLICATE_PATTERNS.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);

  if (replicateScore > extractScore) return "replicate_layout";
  if (extractScore > replicateScore) return "extract_inspiration";
  /** Default when ambiguous: lean layout-faithful (most 「贴截图」诉求） */
  return "replicate_layout";
}

export function screenshotGuardrailIdForMode(mode: ScreenshotIntentMode): string | null {
  if (mode === "extract_inspiration") return "screenshotExtractInspiration";
  if (mode === "replicate_layout") return "screenshotLayoutFidelity";
  return null;
}

/** Guardrail id when an image is attached, or null if mode is none. */
export function screenshotGuardrailIdFromContext(
  mode: ScreenshotIntentMode | undefined,
  hasReferenceImage: boolean
): string | null {
  if (!hasReferenceImage) return null;
  const m = mode ?? "replicate_layout";
  return screenshotGuardrailIdForMode(m);
}
