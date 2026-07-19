/**
 * Policy for coalescing concurrent `syncStaticSitePreview` calls.
 *
 * Mid-generation Studio may start a sync while `app/page.tsx` is still the stub.
 * Post-generation (and Rebuild with force) must not join that in-flight work — otherwise
 * Storage gets the stub export and only a later force rebuild shows the real site.
 */
export type InFlightSyncPolicy = "join" | "wait-then-run" | "run";

export function resolveInFlightSyncPolicy(args: {
  hasInFlight: boolean;
  force: boolean;
}): InFlightSyncPolicy {
  if (!args.hasInFlight) return "run";
  if (args.force) return "wait-then-run";
  return "join";
}

/**
 * After a long `next build`, sources may have moved on (stub → real page).
 * Do not publish / stamp with the pre-build fingerprint in that case.
 */
export function staticExportFingerprintDrifted(
  fingerprintAtSyncStart: string,
  fingerprintAfterBuild: string
): boolean {
  return fingerprintAtSyncStart !== fingerprintAfterBuild;
}

/**
 * Force sync may stamp local `files_hash` before restore so a just-finished
 * generate tree is not replaced by a stale Storage snapshot.
 *
 * Never do that while `app/page.tsx` is still the Preparing stub — stamping the
 * stub fingerprint hides Storage drift and blocks restoring the real home page.
 */
export function shouldStampLocalFingerprintBeforeEnsure(args: {
  force: boolean;
  localHomeIsPreparingStub: boolean;
}): boolean {
  return args.force && !args.localHomeIsPreparingStub;
}
