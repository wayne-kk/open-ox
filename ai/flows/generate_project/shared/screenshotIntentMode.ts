import type { ScreenshotIntentMode } from "../types";

const EXTRACT_PATTERNS: RegExp[] = [
  /\b(?:借鉴|提取|灵感|气质|风格类似|大致|差不多就行|不必(?:完全)?一致|不要(?:完全)?一样|loosely|inspired by)\b/i,
  /\b(?:只要|主要)(?:文案|配色|token|色值|字体)/i,
  /(?:参考|借鉴).{0,6}(?:风格|配色|文案|布局感受)/i,
  /参考.{0,8}风格/i,
];

/** Wording that means layout-fidelity replicate even if「参考」also appears. */
export const STRONG_REPLICATE_PATTERNS: RegExp[] = [
  /\b(?:复刻|还原|高保真|一比一|1:1|按图|对着图|严格(?:对照|按)|像素级|一模一样|wireframe|mockup)\b/i,
  /\b(?:尽量|需要).{0,4}(?:一致|相同|还原)/i,
  /原设计/,
  /设计稿/,
  /设计效果/,
  /(?:业务|产品).{0,8}(?:看板|dashboard|界面).{0,12}(?:截图|复刻|还原)/i,
  /参考.{0,15}(?:截图|设计稿|原设计|设计效果|mockup|wireframe|界面)/i,
  /(?:截图|设计稿).{0,15}(?:复刻|还原|生成|实现|照着)/i,
];

const EXTRACT_ONLY_PATTERNS: RegExp[] = [
  /\b(?:只要|主要)(?:文案|配色|token|色值|字体)/i,
  /(?:不必|不要)(?:完全)?(?:一致|一样|复刻)/i,
  /风格类似|借鉴.{0,6}气质|提取.{0,6}灵感/i,
  /参考.{0,8}风格/i,
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

  if (hasExplicitExtractOnlyIntent(t)) return "extract_inspiration";

  if (hasStrongReplicateWording(t)) return "replicate_layout";

  const extractScore = EXTRACT_PATTERNS.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  const replicateScore = STRONG_REPLICATE_PATTERNS.reduce(
    (n, re) => n + (re.test(t) ? 1 : 0),
    0
  );

  if (replicateScore > extractScore) return "replicate_layout";
  if (extractScore > replicateScore) return "extract_inspiration";

  // 有截图且未明确要求「只提取风格/配色」→ 默认按版式复刻
  if (!hasExplicitExtractOnlyIntent(t)) return "replicate_layout";

  return "replicate_layout";
}

export function hasStrongReplicateWording(userInput: string): boolean {
  const t = userInput.trim();
  if (!t) return false;
  return STRONG_REPLICATE_PATTERNS.some((re) => re.test(t));
}

export function hasExplicitExtractOnlyIntent(userInput: string): boolean {
  const t = userInput.trim();
  if (!t) return false;
  return EXTRACT_ONLY_PATTERNS.some((re) => re.test(t));
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
