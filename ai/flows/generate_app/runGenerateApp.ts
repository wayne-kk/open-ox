import { runGenerateProject } from "../generate_project/runGenerateProject";
import type { BuildStep, GenerateProjectResult } from "../generate_project/types";
import type { CheckpointResult } from "../generate_project/shared/checkpoint";
import { withPromptProfile } from "@/ai/prompts/core/profile";

interface RunGenerateAppOptions {
  projectId?: string;
  styleGuide?: string;
  enableSkills?: boolean;
  useDatabasePrompts?: boolean;
  checkpoint?: CheckpointResult;
}

/**
 * App generation keeps the same execution graph as web for now, while using
 * the dedicated app prompt profile and prompt directory tree.
 */
export async function runGenerateApp(
  userInput: string,
  onStep?: (step: BuildStep) => void,
  options?: RunGenerateAppOptions
): Promise<GenerateProjectResult> {
  return withPromptProfile("app", () =>
    runGenerateProject(userInput, onStep, {
      projectId: options?.projectId,
      styleGuide: options?.styleGuide,
      enableSkills: options?.enableSkills,
      useDatabasePrompts: options?.useDatabasePrompts,
      checkpoint: options?.checkpoint,
    })
  );
}
