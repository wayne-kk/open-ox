/** JSON stored in generation_runs.payload — executed only by trusted worker/API */
export type GenerationRunPayloadBody = {
  requestingUserId: string;
  effectivePrompt: string;
  effectiveModel?: string;
  /**
   * Generation effort tier: fast | balanced | deep.
   * Overlays step models/thinking after DB step configs (chrome-first pipeline).
   */
  effortTier?: "fast" | "balanced" | "deep" | string;
  effectiveGenerationMode: string;
  retryProjectId?: string;
  preCreatedProjectId?: string;
  resumeFromCheckpoint: boolean;
  styleGuide?: string;
  /**
   * User-confirmed vibe fork (confirm_vibe). When set, generation uses this
   * markdown as design intent instead of (or ahead of) inferred design intent.
   */
  confirmedDesignDirectionMarkdown?: string;
  /** Keywords from the confirmed vibe — merged into blueprint designIntent.keywords */
  confirmedDesignDirectionKeywords?: string[];
  enableSkills: boolean;
  enableIntentGuide: boolean;
  langfuseSessionId?: string;
  /**
   * Continue this Langfuse trace id in the generation worker (intent commit → build).
   * Omit on retries so each failed re-run opens a new root (link via previousLangfuseTraceId).
   */
  langfuseTraceId?: string;
  /** Prior build trace id when this run is a retry (metadata only). */
  previousLangfuseTraceId?: string;
  useDatabasePrompts: boolean;
  /** Data URL or raw base64 — worker passes to `project_intent_guide` vision when set */
  initialImageBase64?: string;
  /** Bootstrap / intent-session texts for image URL extraction (not merged into effectivePrompt). */
  userImageSourceTexts?: string[];
};

export type GenerationRunRow = {
  id: string;
  project_id: string;
  status: string;
  kind: string;
  resume_from_checkpoint: boolean;
  payload: GenerationRunPayloadBody;
};
