/**
 * Pure Studio interaction gate: generation readiness → per-capability decisions.
 * No React / i18n / fetch. UI and (later) API adapters share this entry point.
 */

export type StudioCapability =
  | "code"
  | "preview"
  | "deploy"
  | "publishPreview"
  | "feishuEdit"
  | "history"
  | "modify"
  | "topology";

export type StudioCapabilityReasonCode =
  | "studio_loading"
  | "project_missing"
  | "awaiting_input"
  | "generation_in_progress"
  | "generation_failed"
  | "verification_failed"
  | "verification_missing"
  | "static_preview_missing"
  | "no_operable_artifact";

export type CapabilityDecision =
  | { allowed: true }
  | { allowed: false; reason: StudioCapabilityReasonCode };

export type StudioProjectLifecycleStatus =
  | "awaiting_input"
  | "generating"
  | "ready"
  | "failed";

export type StudioCapabilitySnapshot = {
  status: StudioProjectLifecycleStatus;
  verificationStatus?: "passed" | "failed";
  hydration: "loading" | "ready";
  /** Publish Preview requires a synced static export. */
  hasStaticPreview?: boolean;
  /**
   * Inspect/modify surfaces (history, modify): evidence of operable project
   * content — not a delivery gate for code/preview/deploy.
   */
  hasOperableArtifact?: boolean;
};

export type StudioCapabilities = Readonly<
  Record<StudioCapability, CapabilityDecision>
>;

const DELIVERY_CAPABILITIES = [
  "code",
  "preview",
  "deploy",
  "publishPreview",
  "feishuEdit",
] as const satisfies readonly StudioCapability[];

const INSPECT_CAPABILITIES = ["history", "modify"] as const satisfies readonly StudioCapability[];

function deny(reason: StudioCapabilityReasonCode): CapabilityDecision {
  return { allowed: false, reason };
}

function allow(): CapabilityDecision {
  return { allowed: true };
}

function allDenied(
  reason: StudioCapabilityReasonCode,
  opts?: { topologyAlways?: boolean }
): StudioCapabilities {
  const topology = opts?.topologyAlways ? allow() : deny(reason);
  return {
    code: deny(reason),
    preview: deny(reason),
    deploy: deny(reason),
    publishPreview: deny(reason),
    feishuEdit: deny(reason),
    history: deny(reason),
    modify: deny(reason),
    topology,
  };
}

function deliveryBlockedReason(
  snapshot: StudioCapabilitySnapshot
): StudioCapabilityReasonCode | null {
  switch (snapshot.status) {
    case "awaiting_input":
      return "awaiting_input";
    case "generating":
      return "generation_in_progress";
    case "failed":
      return "generation_failed";
    case "ready":
      if (snapshot.verificationStatus === "passed") return null;
      if (snapshot.verificationStatus === "failed") return "verification_failed";
      return "verification_missing";
    default:
      return "generation_failed";
  }
}

/**
 * Evaluate Studio interaction capabilities from a normalized project snapshot.
 * Total function: never throws; unknown/missing project → denied decisions.
 */
export function evaluateStudioCapabilities(
  input: StudioCapabilitySnapshot | null
): StudioCapabilities {
  if (input == null) {
    return allDenied("project_missing", { topologyAlways: true });
  }

  if (input.hydration === "loading") {
    return allDenied("studio_loading", { topologyAlways: true });
  }

  const deliveryReason = deliveryBlockedReason(input);
  const delivery: CapabilityDecision = deliveryReason
    ? deny(deliveryReason)
    : allow();

  const publishPreview: CapabilityDecision =
    delivery.allowed === false
      ? delivery
      : input.hasStaticPreview
        ? allow()
        : deny("static_preview_missing");

  const inspect: CapabilityDecision = input.hasOperableArtifact
    ? allow()
    : deny("no_operable_artifact");

  const result = {
    topology: allow(),
    history: inspect,
    modify: inspect,
    code: delivery,
    preview: delivery,
    deploy: delivery,
    feishuEdit: delivery,
    publishPreview,
  } satisfies StudioCapabilities;

  // Ensure every delivery key is present (compile-time + runtime sanity).
  for (const key of DELIVERY_CAPABILITIES) {
    void result[key];
  }
  for (const key of INSPECT_CAPABILITIES) {
    void result[key];
  }

  return result;
}
