/** JSON stored in generation_runs.payload — executed only by trusted worker/API */
export type GenerationRunPayloadBody = {
  requestingUserId: string;
  effectivePrompt: string;
  effectiveModel?: string;
  effectiveGenerationMode: string;
  retryProjectId?: string;
  preCreatedProjectId?: string;
  resumeFromCheckpoint: boolean;
  styleGuide?: string;
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
