export type DeploymentFreshness =
  | "never_deployed"
  | "up_to_date"
  | "updates_available"
  | "unknown";

export function deploymentFreshness(input: {
  productionUrl: string | null;
  currentVersionId: string | null;
  deployedVersionId: string | null;
  currentSourceFingerprint?: string | null;
  deployedSourceFingerprint?: string | null;
}): DeploymentFreshness {
  if (!input.productionUrl) return "never_deployed";
  if (input.currentSourceFingerprint && input.deployedSourceFingerprint) {
    return input.currentSourceFingerprint === input.deployedSourceFingerprint
      ? "up_to_date"
      : "updates_available";
  }
  if (input.currentVersionId && input.deployedVersionId) {
    return input.currentVersionId === input.deployedVersionId
      ? "up_to_date"
      : "updates_available";
  }
  if (input.currentVersionId) return "updates_available";
  return "unknown";
}
