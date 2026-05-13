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
};

export type GenerationRunRow = {
  id: string;
  project_id: string;
  status: string;
  kind: string;
  resume_from_checkpoint: boolean;
  payload: GenerationRunPayloadBody;
};
