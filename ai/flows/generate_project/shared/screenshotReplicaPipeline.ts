import type { PageAgentProjectContext, ScreenshotIntentMode } from "../types";
import {
  hasExplicitExtractOnlyIntent,
  hasStrongReplicateWording,
} from "./screenshotIntentMode";

/** Env flag — default off so existing flows are unchanged until explicitly enabled. */
export function isScreenshotReplicaPipelineEnabled(): boolean {
  const v = process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE?.trim();
  if (v === "0" || v === "false") return false;
  // Default on: screenshot replicate path is the intended production behavior.
  return v === "1" || v === "true" || v == null || v === "";
}

export function isScreenshotReplicateIntent(
  mode: ScreenshotIntentMode,
  hasReferenceScreenshot: boolean
): boolean {
  return hasReferenceScreenshot && mode === "replicate_layout";
}

export function resolvePageGenerationScreenshotMode(
  mode: ScreenshotIntentMode,
  pageCount: number
): ScreenshotIntentMode {
  return mode === "replicate_layout" && pageCount > 1 ? "extract_inspiration" : mode;
}

/**
 * Replicate-from-screenshot must not use built-in hero/component skills.
 * Applies for layout-fidelity mode, strong replicate wording, or pasted screenshot
 * without explicit extract-only intent (even if mode was misclassified).
 */
export function shouldBlockSkillsForScreenshotReplicate(
  mode: ScreenshotIntentMode,
  hasReferenceScreenshot: boolean,
  userInput?: string
): boolean {
  if (!hasReferenceScreenshot || mode === "none") return false;

  const text = userInput?.trim() ?? "";
  if (text && hasExplicitExtractOnlyIntent(text)) return false;

  if (isScreenshotReplicateIntent(mode, hasReferenceScreenshot)) return true;
  if (text && hasStrongReplicateWording(text)) return true;
  if (!text) return mode === "replicate_layout";

  return mode !== "extract_inspiration";
}

/**
 * Screenshot replicate does not run Chrome Scaffold / Optimize — page sections own full layout.
 */
export function shouldSkipChromeScaffoldForScreenshotReplicate(
  mode: ScreenshotIntentMode,
  hasReferenceScreenshot: boolean,
  userInput?: string
): boolean {
  return shouldBlockSkillsForScreenshotReplicate(mode, hasReferenceScreenshot, userInput);
}

/** When true, Page Agent may scan rawUserInput for Google image URLs. */
export function shouldScanPromptForUserImageUrls(
  mode: ScreenshotIntentMode | undefined,
  hasReferenceScreenshot: boolean,
  userInput?: string
): boolean {
  return !shouldBlockSkillsForScreenshotReplicate(
    mode ?? "none",
    hasReferenceScreenshot,
    userInput
  );
}

/** Full two-stage analyzer → section replica path (feature-flagged). */
export function shouldUseScreenshotReplicaPipeline(
  ctx: Pick<
    PageAgentProjectContext,
    "referenceScreenshotDataUrl" | "screenshotIntentMode"
  >
): boolean {
  if (!isScreenshotReplicaPipelineEnabled()) return false;
  return isScreenshotReplicateIntent(
    ctx.screenshotIntentMode ?? "none",
    Boolean(ctx.referenceScreenshotDataUrl?.trim())
  );
}
