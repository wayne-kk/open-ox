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
  useDatabasePrompts: boolean;
  /** Data URL or raw base64 — worker passes to `project_intent_guide` vision when set */
  initialImageBase64?: string;
  /**
   * When true, the worker must treat this run as screenshot-driven for gating (e.g. skip
   * `match_design_system_skill`) even if `initialImageBase64` is missing from the stored payload.
   */
  referenceScreenshotCommitted?: boolean;
};

export type GenerationRunRow = {
  id: string;
  project_id: string;
  status: string;
  kind: string;
  resume_from_checkpoint: boolean;
  payload: GenerationRunPayloadBody;
};
