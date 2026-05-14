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
import { scheduleUploadFullProject } from "@/lib/storage";
import { scheduleCaptureProjectCover } from "@/lib/projectCoverCapture";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import { loadStepModelsFromDB } from "@/lib/config/models";
import {
  loadCoreStepPromptsFromDB,
  normalizePromptProfile,
  withCorePromptRuntime,
} from "@/lib/config/corePrompts";
import { redactBuildStepForTransport } from "@/ai/flows/generate_project/shared/buildStepPayload";
import { shouldSkipNamingFromBlueprintTitle } from "@/ai/flows/generate_project/intentAgent/commitMergeBrief";
import { appendTrajectoryEvent, createRunEndEvent, createTrajectoryRun } from "@/lib/trajectory/store";
import {
  flushLangfuse,
  resolveLangfuseSessionId,
  runWithLangfuseTraceRoot,
} from "@/lib/observability/langfuseTracing";
import { LfTrace } from "@/lib/observability/langfuseTraceCatalog";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenerationRunRow } from "./types";

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

    let trajectory: { runId: string; taskId: string } | null = null;
    let trajectoryQueue: Promise<void> = Promise.resolve();

    try {
      const taskId = `project:${projectId}`;
      const traj = await createTrajectoryRun({
        task_id: taskId,
        goal: effectivePrompt,
        task_spec_ref: "open-ox.generate-project",
        environment: {
          route: "/api/generation-worker",
          project_id: projectId,
          mode: retryProjectId ? "retry" : preCreatedProjectId ? "precreated" : "new",
        },
        success_criteria: [
          "generation completed",
          "run has deterministic end state",
          "build verification status recorded",
        ],
        meta: {
          source: "generation-worker",
          model: payload.effectiveModel ?? null,
          generation_run_id: generationRunUuid,
        },
      });
      trajectory = { runId: traj.runId, taskId };
    } catch (err) {
      console.warn("[generation-worker] trajectory run creation failed:", err);
    }

    const enqueueTrajectoryEvent = (
      evt: Parameters<typeof appendTrajectoryEvent>[1]
    ) => {
      if (!trajectory) return;
      const runId = trajectory.runId;
      trajectoryQueue = trajectoryQueue
        .then(async () => {
          await appendTrajectoryEvent(runId, evt);
        })
        .catch((trajectoryErr: unknown) => {
          console.warn("[generation-worker] trajectory append failed:", trajectoryErr);
        });
    };

    let repairEpisodeSeq = 0;
    let activeRepairEpisode: {
      episodeId: string;
      triggerStep: string;
      errorDetail: string;
      startedAt: number;
    } | null = null;

    const mapPhase = (stepName: string): "setup" | "planning" | "execution" | "verification" | "finalize" => {
      if (
        stepName.includes("analyze") ||
        stepName.includes("plan") ||
        stepName.includes("intent_guide") ||
        stepName.includes("intent_agent")
      ) {
        return "planning";
      }
      if (stepName.includes("build") || stepName.includes("typecheck")) return "verification";
      if (stepName.includes("clear") || stepName.includes("checkpoint")) return "setup";
      if (stepName.includes("run")) return "finalize";
      return "execution";
    };
    const isShellLikeStep = (stepName: string) =>
      stepName.includes("build") ||
      stepName.includes("install_dependencies") ||
      stepName.includes("repair_build") ||
      stepName.includes("typecheck");
    const summarizeError = (detail?: string) => {
      if (!detail) return "unknown_error";
      return detail.split("\n")[0]?.slice(0, 240) || "unknown_error";
    };

    if (payload.effectiveModel) {
      setRuntimeModelId(payload.effectiveModel as ModelId);
    }
    await loadStepModelsFromDB();
    const promptProfile = normalizePromptProfile(payload.effectiveGenerationMode as "web");

    const useDatabasePrompts = payload.useDatabasePrompts === true;
    const corePromptOverrides = useDatabasePrompts
      ? await loadCoreStepPromptsFromDB(promptProfile)
      : new Map();

    const langfuseSessionKey = resolveLangfuseSessionId({
      projectId,
      clientSessionId: payload.langfuseSessionId,
      trajectoryRunId: trajectory?.runId,
    });

    let persistTail: Promise<void> = Promise.resolve();

    const onStepForPipeline = (step: BuildStep) => {
      eventSeq += 1;
      const seq = eventSeq;
      persistTail = persistTail.then(() => persistGenerationStep(admin, generationRunUuid, seq, step));

      const phase = mapPhase(step.step);

      if (step.status === "error" && isShellLikeStep(step.step)) {
        const episodeId = `${projectId}-repair-${++repairEpisodeSeq}`;
        activeRepairEpisode = {
          episodeId,
          triggerStep: step.step,
          errorDetail: step.detail ?? "unknown_error",
          startedAt: Date.now(),
        };
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase: "execution",
          event_type: "repair_episode_started",
          actor: "system",
          payload: {
            episode_id: episodeId,
            trigger_step: step.step,
            error_summary: summarizeError(step.detail),
            error_detail: step.detail ?? null,
          },
          meta: { source: "repair_episode" },
        });
      }

      if (activeRepairEpisode && step.step === "repair_build" && step.status === "active") {
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase: "execution",
          event_type: "repair_action_started",
          actor: "agent",
          payload: {
            episode_id: activeRepairEpisode.episodeId,
            action: "repair_build",
            triggered_by: activeRepairEpisode.triggerStep,
          },
          meta: { source: "repair_episode" },
        });
      }

      if (
        activeRepairEpisode &&
        step.step === "repair_build" &&
        (step.status === "ok" || step.status === "error")
      ) {
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase: "execution",
          event_type: "repair_action_result",
          actor: "agent",
          payload: {
            episode_id: activeRepairEpisode.episodeId,
            action: "repair_build",
            status: step.status,
            detail: step.detail ?? null,
            duration: step.duration,
          },
          meta: { source: "repair_episode" },
        });
      }

      if (
        activeRepairEpisode &&
        step.step === "run_build" &&
        (step.status === "ok" || step.status === "error")
      ) {
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase: "verification",
          event_type: "repair_verification_result",
          actor: "system",
          payload: {
            episode_id: activeRepairEpisode.episodeId,
            verification_step: "run_build",
            status: step.status,
            detail: step.detail ?? null,
            duration: step.duration,
          },
          meta: { source: "repair_episode" },
        });
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase: "finalize",
          event_type: "repair_episode_finished",
          actor: "system",
          payload: {
            episode_id: activeRepairEpisode.episodeId,
            outcome: step.status === "ok" ? "resolved" : "unresolved",
            trigger_step: activeRepairEpisode.triggerStep,
            started_at: activeRepairEpisode.startedAt,
            ended_at: Date.now(),
          },
          meta: { source: "repair_episode" },
        });
        activeRepairEpisode = null;
      }

      if (isShellLikeStep(step.step)) {
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase,
          event_type: "shell_command",
          actor: "tool",
          payload: {
            step: step.step,
            status: step.status,
            command: step.step,
            cwd: `sites/${projectId}`,
          },
          meta: { source: "build_step_shell" },
        });
        enqueueTrajectoryEvent({
          task_id: trajectory?.taskId ?? `project:${projectId}`,
          phase,
          event_type: "shell_result",
          actor: "tool",
          payload: {
            step: step.step,
            status: step.status,
            stdout: step.status === "ok" ? (step.detail ?? "") : "",
            stderr: step.status === "error" ? (step.detail ?? "") : "",
            exit_code: step.status === "ok" ? 0 : step.status === "error" ? 1 : null,
            duration: step.duration,
          },
          meta: { source: "build_step_shell" },
        });
      }
      enqueueTrajectoryEvent({
        task_id: trajectory?.taskId ?? `project:${projectId}`,
        phase,
        event_type: "checkpoint",
        actor: "agent",
        payload: {
          step: step.step,
          status: step.status,
          detail: step.detail ?? null,
          duration: step.duration,
          timestamp: step.timestamp,
        },
        meta: { source: "build_step" },
      });
    };

    const result = await runWithLangfuseTraceRoot(
      {
        name: LfTrace.generateProject,
        userId: requestingUserId,
        sessionId: langfuseSessionKey,
        tags: ["flow:generate_project", "route:generation_worker"],
        metadata: {
          projectId,
          generationRunId: generationRunUuid,
          retry: retryProjectId != null,
          preCreatedProjectId: preCreatedProjectId != null,
        },
        input: { userPrompt: effectivePrompt },
      },
      () =>
        withCorePromptRuntime(
          {
            promptProfile,
            useDatabasePrompts,
            dbPromptByStepId: corePromptOverrides,
          },
          () =>
            runGenerateProject(effectivePrompt, onStepForPipeline, {
              projectId,
              styleGuide: payload.styleGuide,
              enableSkills: payload.enableSkills !== false,
              useDatabasePrompts,
              checkpoint,
              enableIntentGuide: payload.enableIntentGuide !== false,
              langfuseUserId: requestingUserId,
              langfuseSessionId: langfuseSessionKey,
            })
        )
    );

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
      scheduleUploadFullProject(projectId);
      scheduleCaptureProjectCover(projectId);
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

    if (trajectory) {
      enqueueTrajectoryEvent({
        task_id: trajectory.taskId,
        phase: result.verificationStatus === "passed" ? "verification" : "finalize",
        event_type: result.verificationStatus === "passed" ? "test_result" : "error",
        actor: "system",
        payload: {
          success: result.success,
          verificationStatus: result.verificationStatus,
          generatedFiles: result.generatedFiles.length,
          error: result.error ?? null,
        },
        meta: { source: "generation_summary" },
      });
    }

    if (trajectory) {
      await trajectoryQueue;
      await createRunEndEvent(trajectory.runId, trajectory.taskId, "system", {
        success: result.success,
        verificationStatus: result.verificationStatus,
        error: result.error ?? null,
        generatedFiles: result.generatedFiles.length,
        projectId,
      }).catch(() => null);
    }

    await finalizeRunRecord(admin, generationRunUuid, {
      status: result.success ? "succeeded" : "failed",
      error: result.success ? null : result.error ?? "Generation failed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
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
