/**
 * SDK Engine - Generate Project Bridge (runtime-only, not compiled by tsc)
 *
 * This module bridges the SDK's clean interface to the existing
 * runGenerateProject implementation at runtime via dynamic import.
 */

/** @param {string} userInput */
/** @param {Function|undefined} onStep */
/** @param {object} options */
export async function runGenerateProject(userInput, onStep, options) {
  // Configure model overrides — these modules live in the main project
  const { setRuntimeModelId, setStepModel, setStepThinkingLevel, clearStepModels } =
    await import("../../../lib/config/models.js");
  const { setSiteRoot, clearSiteRoot } = await import("../../../ai/tools/system/common.js");
  const { withPromptProfile } = await import("../../../ai/prompts/core/profile.js");

  // Apply LLM config
  if (options.llmConfig?.model) {
    setRuntimeModelId(options.llmConfig.model);
  }

  // Apply per-step model overrides
  clearStepModels();
  if (options.llmConfig?.stepModels) {
    for (const [step, model] of Object.entries(options.llmConfig.stepModels)) {
      setStepModel(step, model);
    }
  }
  if (options.llmConfig?.stepThinkingLevels) {
    for (const [step, level] of Object.entries(options.llmConfig.stepThinkingLevels)) {
      setStepThinkingLevel(step, level);
    }
  }

  // Set site root to project path
  setSiteRoot(options.projectPath);

  try {
    const { runGenerateProject: coreGenerate } =
      await import("../../../ai/flows/generate_project/runGenerateProject.js");

    const profile = options.mode ?? "web";

    const result = await withPromptProfile(profile, () =>
      coreGenerate(userInput, onStep, {
        projectId: options.projectId,
        styleGuide: options.styleGuide,
        enableSkills: options.enableSkills,
      })
    );

    return result;
  } finally {
    clearSiteRoot();
    setRuntimeModelId(null);
    clearStepModels();
  }
}
