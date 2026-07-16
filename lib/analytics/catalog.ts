/** Stable product-analytics event names (first-party). */
export const AnalyticsEventName = {
  pageView: "page_view",
  studioEnter: "studio_enter",
  studioHeartbeat: "studio_heartbeat",
  authSuccess: "auth_success",
  acquisitionCaptured: "acquisition_captured",
  intentAgentStart: "intent_agent_start",
  intentTurn: "intent_turn",
  generationRunQueued: "generation_run_queued",
  projectReady: "project_ready",
  modifyStart: "modify_start",
  modifyComplete: "modify_complete",
  previewOpen: "preview_open",
  designModeModifyHandoff: "design_mode_modify_handoff",
  designModeDirectPatch: "design_mode_direct_patch",
  onboardingStepView: "onboarding_step_view",
  onboardingGenerateStarted: "onboarding_generate_started",
  onboardingGeneratePreviewReady: "onboarding_generate_preview_ready",
  onboardingDesignComplete: "onboarding_design_complete",
  firstModifySend: "first_modify_send",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEventName)[keyof typeof AnalyticsEventName];

/** First-touch acquisition snapshot attached to events / stored on users. */
export type AcquisitionProperties = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
};

export type AcquisitionChannel = "utm" | "referral" | "direct";
