/**
 * SDK Engine - Modify Project Bridge (runtime-only, not compiled by tsc)
 */

/** @param {string} projectId */
/** @param {string} instruction */
/** @param {Function} onEvent */
/** @param {object} options */
export async function runModifyProject(projectId, instruction, onEvent, options) {
  const { setRuntimeModelId, clearStepModels } =
    await import("../../../lib/config/models.js");
  const { setSiteRoot, clearSiteRoot } = await import("../../../ai/tools/system/common.js");

  if (options.model || options.llmConfig?.model) {
    setRuntimeModelId(options.model ?? options.llmConfig?.model ?? null);
  }

  setSiteRoot(options.projectPath);

  try {
    const mockDb = createMinimalProjectStore(projectId, options.projectPath);

    const { runModifyProject: coreModify } =
      await import("../../../ai/flows/modify_project/runModifyProject.js");

    await coreModify(
      mockDb,
      projectId,
      instruction,
      onEvent,
      options.conversationHistory,
      options.clearContext,
      options.imageBase64,
      options.model
    );
  } finally {
    clearSiteRoot();
    setRuntimeModelId(null);
    clearStepModels();
  }
}

function createMinimalProjectStore(projectId, projectPath) {
  const projectData = {
    id: projectId,
    userPrompt: "",
    status: "ready",
    generationMode: "web",
    modificationHistory: [],
  };

  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (col, val) => ({
          single: async () => {
            if (table === "projects" && col === "id" && val === projectId) {
              return { data: projectData, error: null };
            }
            return { data: null, error: { message: "Not found" } };
          },
        }),
      }),
      update: (data) => ({
        eq: (col, val) => ({
          then(resolve) {
            if (table === "projects" && col === "id" && val === projectId) {
              Object.assign(projectData, data);
            }
            resolve({ data: null, error: null });
          },
        }),
      }),
    }),
  };
}
