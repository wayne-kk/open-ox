import type { StepTrace } from "../types";
import type { SelectedDesignSystemSkill } from "@/lib/generation/selectedDesignSystemSkill";

export type DesignSystemSurfaceMode = "marketing" | "web-app";
export type DesignSystemSkillContentFormat = "open-ox-v1" | "reference-v1";
export type DesignSystemScreenshotMode =
  | "none"
  | "extract_inspiration"
  | "replicate_layout";

export interface DesignSystemSkillMetadata {
  id: string;
  version: string;
  contractVersion: number;
  contentFormat: DesignSystemSkillContentFormat;
  status: "active" | "disabled";
  aliases: string[];
  positiveSignals: {
    moods: string[];
    colors: string[];
    productTypes: string[];
  };
  negativeSignals: {
    moods: string[];
    colors: string[];
    productTypes: string[];
  };
  supportedModes: DesignSystemSurfaceMode[];
}

export interface DesignSystemSkill {
  metadata: DesignSystemSkillMetadata;
  content: string;
}

export interface DesignSystemSkillCatalog {
  list(): DesignSystemSkill[];
  get(id: string): DesignSystemSkill | null;
}

export interface DesignSystemResolutionRequest {
  userInput: string;
  designIntentMarkdown: string;
  projectType?: string;
  surfaceMode?: DesignSystemSurfaceMode;
  screenshotMode?: DesignSystemScreenshotMode;
  selectedSkill?: SelectedDesignSystemSkill;
  legacyStyleGuide?: string;
  matchingEnabled?: boolean;
}

export interface DesignSystemJudgeDecision {
  skillId: string | null;
  confidence: number;
  evidence: string[];
  conflicts: string[];
  reason: string;
}

export interface DesignSystemCandidate {
  skillId: string;
  score: number;
  matchedSignals: string[];
  conflicts: string[];
}

export interface DesignSystemResolutionTrace {
  candidates: DesignSystemCandidate[];
  decision?: DesignSystemJudgeDecision;
  judgeTrace?: StepTrace;
  generationTrace?: StepTrace;
}

export type DesignSystemFallbackReason =
  | "matching_disabled"
  | "no_candidate"
  | "low_confidence"
  | "ambiguous"
  | "explicit_conflict"
  | "skill_invalid"
  | "matcher_error"
  | "screenshot_replica";

export type DesignSystemResolution =
  | {
      source: "skill";
      designSystem: string;
      skillId: string;
      skillVersion: string;
      confidence: number;
      reason: "explicit_selection" | "automatic_match";
      trace: DesignSystemResolutionTrace;
    }
  | {
      source: "generated";
      designSystem: string;
      fallbackReason: DesignSystemFallbackReason;
      trace: DesignSystemResolutionTrace;
    };

export interface DesignSystemResolverDependencies {
  catalog: DesignSystemSkillCatalog;
  judge(
    request: DesignSystemResolutionRequest,
    candidates: DesignSystemCandidate[],
  ): Promise<{ decision: DesignSystemJudgeDecision; trace?: StepTrace }>;
  generate(
    request: DesignSystemResolutionRequest,
  ): Promise<{ designSystem: string; trace?: StepTrace }>;
}

export interface DesignSystemResolver {
  resolve(
    request: DesignSystemResolutionRequest,
  ): Promise<DesignSystemResolution>;
}
