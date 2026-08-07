/**
 * Pure rules for post-generation preview sync + auto cover scheduling.
 * Keep I/O out of this module so Studio/worker races stay unit-testable.
 */

/** Match Studio `openPreviewAfterBuild` force-rebuild stub retries. */
export const STATIC_PREVIEW_STUB_RETRY_ATTEMPTS = 4;
export const STATIC_PREVIEW_STUB_RETRY_DELAY_MS = 1_200;

export type StaticPreviewSyncSkipLike = {
  skipped?: boolean;
  skippedReason?: string;
};

/** True when force sync soft-skipped because home is still the Preparing stub. */
export function isPreparingStubPreviewSkip(result: StaticPreviewSyncSkipLike): boolean {
  return result.skipped === true && result.skippedReason === "preparing_stub";
}

/**
 * Auto cover needs a published static preview when the deploy publishes to Storage.
 * When static publish is off (local-only), cover may still fall back to local next.
 */
export function shouldScheduleAutoCoverAfterPipeline(args: {
  publishesStaticPreview: boolean;
  staticPreviewReady: boolean;
}): boolean {
  if (!args.publishesStaticPreview) return true;
  return args.staticPreviewReady;
}
