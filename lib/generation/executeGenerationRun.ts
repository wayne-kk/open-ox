import { runGenerateProject } from "@/ai/flows";
import type { BuildStep } from "@/ai/flows";
import {
  detectCheckpoint,
  type CheckpointResult,
} from "@/ai/flows/generate_project/shared/checkpoint";
import {
  getProject,
  initProjectDir,
  updateProjectStatus,
  renameProject,
} from "@/lib/projectManager";
import { schedulePostGenerationPreviewPipeline } from "@/lib/postGenerationPreviewPipeline";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import { loadStepModelsFromDB } from "@/lib/config/models";
import {
  normalizePromptProfile,
  withCorePromptRuntime,
} from "@/lib/config/corePrompts";
import { redactBuildStepForTransport } from "@/ai/flows/generate_project/shared/buildStepPayload";
import { shouldSkipNamingFromBlueprintTitle } from "@/ai/flows/generate_project/intentAgent/commitMergeBrief";
import { flushLangfuse, resolveLangfuseSessionId } from "@/lib/observability/langfuseTracing";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenerationRunRow } from "./types";
import { upsertBuildStepByName } from "./foldStepEvents";

/** Pre-commit intent rounds are stored as `intent_agent` on the project row; the pipeline replaces `build_steps` at the end — preserve those steps so Studio can restore the dialogue. */
function mergeIntentAgentStepsIntoFinal(
  existing: Awaited<ReturnType<typeof getProject>>,
  pipelineSteps: BuildStep[]
): BuildStep[] {
  const preserved = ((existing?.buildSteps ?? []) as BuildStep[]).filter((s) => s.step === "intent_agent");
  return [...preserved, ...pipelineSteps];
}

async function persistGenerationStep(
  admin: SupabaseClient,
  generationRunUuid: string,
  seq: number,
  step: BuildStep
): Promise<void> {
  const payload = redactBuildStepForTransport(step) as unknown as Record<string, unknown>;
  const { error } = await admin.from("generation_events").insert({
    run_id: generationRunUuid,
    seq,
    step: payload,
  });
  if (error) {
    console.warn("[generation] append event failed:", error.message);
  }
}

async function finalizeRunRecord(
  admin: SupabaseClient,
  generationRunUuid: string,
  patch: {
    status: "succeeded" | "failed" | "cancelled";
    error?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("generation_runs")
    .update({
      status: patch.status,
      error: patch.error ?? null,
      finished_at: now,
      updated_at: now,
      lease_owner: null,
      lease_until: null,
    })
    .eq("id", generationRunUuid);
}

/**
 * Executes one queued generation run (called only from the worker, using service-role DB).
 */
export async function executeGenerationRun(args: {
  admin: SupabaseClient;
  run: GenerationRunRow;
  workerHostname: string;
}): Promise<void> {
  const { admin, run } = args;
  const generationRunUuid = run.id;
  const payload = run.payload;
  const projectId = run.project_id;
  const requestingUserId = payload.requestingUserId;
  let eventSeq = 0;

  const effectivePrompt = payload.effectivePrompt;
  const retryProjectId = payload.retryProjectId;
  const preCreatedProjectId = payload.preCreatedProjectId;
  const resumeFromCheckpoint = payload.resumeFromCheckpoint === true;

  let liveStepsTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    const { data: runState } = await admin
      .from("generation_runs")
      .select("status")
      .eq("id", generationRunUuid)
      .single();
    if (runState?.status === "cancelled") {
      await finalizeRunRecord(admin, generationRunUuid, { status: "cancelled", error: null });
      return;
    }

    if (retryProjectId) {
      await updateProjectStatus(admin, projectId, "generating", {
        error: undefined,
        ...(resumeFromCheckpoint ? {} : { buildSteps: [] }),
      });
    }

    if (!retryProjectId) {
      await initProjectDir(admin, projectId);
    }

    let checkpoint: CheckpointResult | undefined;
    if (retryProjectId || preCreatedProjectId) {
      const existing = await getProject(admin, projectId);
      if (existing && existing.buildSteps && existing.buildSteps.length > 0) {
        checkpoint = detectCheckpoint(existing);
      }
    }

    if (payload.effectiveModel) {
      setRuntimeModelId(payload.effectiveModel as ModelId);
    }
    await loadStepModelsFromDB();
    const promptProfile = normalizePromptProfile(payload.effectiveGenerationMode as "web");

    const useDatabasePrompts = false;
    const corePromptOverrides = new Map();

    const langfuseSessionKey = resolveLangfuseSessionId({
      projectId,
      clientSessionId: payload.langfuseSessionId,
    });

    let persistTail: Promise<void> = Promise.resolve();

    const projectForLiveSteps = await getProject(admin, projectId);
    const resolvedReferenceScreenshot =
      (typeof payload.initialImageBase64 === "string" && payload.initialImageBase64.trim()
        ? payload.initialImageBase64.trim()
        : null) ?? projectForLiveSteps?.referenceImageDataUrl?.trim() ?? null;
    const intentBaseSteps: BuildStep[] = ((projectForLiveSteps?.buildSteps ?? []) as BuildStep[]).filter(
      (s) => s.step === "intent_agent"
    );
    let pipelineFoldedLive: BuildStep[] = [];

    const cancelLiveStepsSchedule = () => {
      if (liveStepsTimer) {
        clearTimeout(liveStepsTimer);
        liveStepsTimer = null;
      }
    };

    const pushLiveBuildStepsNow = async () => {
      const merged = [...intentBaseSteps, ...pipelineFoldedLive];
      try {
        await updateProjectStatus(admin, projectId, "generating", { buildSteps: merged });
      } catch (e) {
        console.warn(
          "[generation-worker] live build_steps update failed:",
          e instanceof Error ? e.message : e
        );
      }
    };

    const scheduleLiveBuildSteps = () => {
      cancelLiveStepsSchedule();
      liveStepsTimer = setTimeout(() => {
        liveStepsTimer = null;
        void pushLiveBuildStepsNow();
      }, 520);
    };

    const onStepForPipeline = (step: BuildStep) => {
      eventSeq += 1;
      const seq = eventSeq;
      persistTail = persistTail.then(() => persistGenerationStep(admin, generationRunUuid, seq, step));

      pipelineFoldedLive = upsertBuildStepByName(pipelineFoldedLive, step);
      scheduleLiveBuildSteps();
    };

    const result = await withCorePromptRuntime(
      {
        promptProfile,
        useDatabasePrompts,
        dbPromptByStepId: corePromptOverrides,
      },
      () =>
        runGenerateProject(effectivePrompt, onStepForPipeline, {
          projectId,
          styleGuide: payload.styleGuide,
          enableSkills: true,
          useDatabasePrompts,
          checkpoint,
          enableIntentGuide: payload.enableIntentGuide !== false,
          userReferenceImageBase64: resolvedReferenceScreenshot ?? undefined,
          langfuseUserId: requestingUserId,
          langfuseSessionId: langfuseSessionKey,
          langfuseTraceTags: ["route:generation_worker"],
          langfuseTraceMetadata: {
            generationRunId: generationRunUuid,
            retry: retryProjectId != null,
            preCreatedProjectId: preCreatedProjectId != null,
          },
          langfuseTraceInput: {
            userPrompt: effectivePrompt,
            hasReferenceScreenshot: Boolean(resolvedReferenceScreenshot),
          },
        })
    );

    cancelLiveStepsSchedule();
    await persistTail;

    const projectSnapshot = await getProject(admin, projectId);

    if (result.success) {
      await updateProjectStatus(admin, projectId, "ready", {
        completedAt: new Date().toISOString(),
        verificationStatus: result.verificationStatus,
        blueprint: result.blueprint,
        buildSteps: mergeIntentAgentStepsIntoFinal(
          projectSnapshot,
          result.steps.map(redactBuildStepForTransport)
        ),
        generatedFiles: result.generatedFiles,
        logDirectory: result.logDirectory,
        totalDuration: result.totalDuration,
        currentGenerationRunId: null,
      });
      const projectTitle = (result.blueprint as { brief?: { projectTitle?: string } })?.brief
        ?.projectTitle;
      if (
        projectTitle &&
        projectTitle.trim() &&
        !shouldSkipNamingFromBlueprintTitle(projectTitle)
      ) {
        await renameProject(admin, projectId, projectTitle.trim());
      }
      schedulePostGenerationPreviewPipeline(admin, projectId);
    } else if (result.intentGuideDeferred && result.intentGuide) {
      await updateProjectStatus(admin, projectId, "failed", {
        error: `[intent_guide] ${result.intentGuide.assistantMessage.slice(0, 480)}`,
        buildSteps: mergeIntentAgentStepsIntoFinal(
          projectSnapshot,
          result.steps.map(redactBuildStepForTransport)
        ),
        currentGenerationRunId: null,
      });
    } else {
      await updateProjectStatus(admin, projectId, "failed", {
        error: result.error ?? "Generation failed",
        buildSteps: mergeIntentAgentStepsIntoFinal(
          projectSnapshot,
          result.steps.map(redactBuildStepForTransport)
        ),
        currentGenerationRunId: null,
      });
    }

    await finalizeRunRecord(admin, generationRunUuid, {
      status: result.success ? "succeeded" : "failed",
      error: result.success ? null : result.error ?? "Generation failed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (liveStepsTimer) {
      clearTimeout(liveStepsTimer);
      liveStepsTimer = null;
    }
    try {
      await updateProjectStatus(admin, projectId, "failed", {
        error: message,
        currentGenerationRunId: null,
      });
    } catch {
      /* best-effort */
    }
    await finalizeRunRecord(admin, generationRunUuid, { status: "failed", error: message });
  } finally {
    await flushLangfuse();
    setRuntimeModelId(null);
  }
}
