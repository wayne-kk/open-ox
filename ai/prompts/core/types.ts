export type PromptKind =
  | "step"
  | "guardrail"
  | "section"
  | "skill"
  | "system"
  | "motion"
  | "layout"
  | "capability"
  | "modify-system";

export interface PromptRef {
  kind: PromptKind;
  id: string;
}

export interface PromptComposeInput {
  blocks: string[];
  dedupe?: boolean;
}
