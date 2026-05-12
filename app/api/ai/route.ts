/**
 * AI API - POST /api/ai
 *
 * 返回 text/event-stream (SSE)，每个 step 完成立即推送：
 *   data: {"type":"step", ...BuildStep}\n\n
 *   data: {"type":"done", "result": ProcessResult}\n\n
 *   data: {"type":"error", "message": string}\n\n
 *
 * Body 可选字段 `langfuseSessionId`：用于自定义 Langfuse Session；不传时默认使用请求里的 `projectId`，同一站点的 intent / generate / modify 会归到同一条 Session。
 */
import { runGenerateProject } from "@/ai/flows";
import {
  detectCheckpoint,
  type CheckpointResult,
} from "@/ai/flows/generate_project/shared/checkpoint";
import {
  createProject,
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
import type { BuildStep } from "@/ai/flows";
import { redactBuildStepForTransport } from "@/ai/flows/generate_project/shared/buildStepPayload";
import { shouldSkipNamingFromBlueprintTitle } from "@/ai/flows/generate_project/intentAgent/commitMergeBrief";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";
import { appendTrajectoryEvent, createRunEndEvent, createTrajectoryRun } from "@/lib/trajectory/store";
import {
  flushLangfuse,
  resolveLangfuseSessionId,
  runWithLangfuseTraceRoot,
} from "@/lib/observability/langfuseTracing";
import { LfTrace } from "@/lib/observability/langfuseTraceCatalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { supabase: db, user } = session;

    const body = await req.json();
    // Accept both "userPrompt" (new) and "input" (legacy) field names
    const userPrompt: unknown = body.userPrompt ?? body.input;
    const modelOverride: string | undefined = body.model;
    const retryProjectId: string | undefined = body.retryProjectId;
    const preCreatedProjectId: string | undefined = body.projectId;
    const styleGuide: string | undefined = body.styleGuide;
    // Default ON. The runGenerateProject pipeline gates skill matching on
    // `options.enableSkills !== false`; align the route layer with that
    // contract so callers (HeroPrompt, build-studio resume) get skill
    // matching unless they explicitly opt out with `enableSkills: false`.
    const enableSkills: boolean = body.enableSkills !== false;
    /** Defaults on: run `project_intent_guide` before analyze; callers may pass false to bypass. */
    const enableIntentGuide: boolean = body.enableIntentGuide !== false;
    // Temporarily force local prompt files only.
    // Ignore remote/database prompt toggle from client requests.
    const useDatabasePrompts = false;
    const folderId: string | null | undefined =
      typeof body.folderId === "string" ? body.folderId : body.folderId === null ? null : undefined;
    const requestGenerationMode: string | undefined = body.generationMode;
    if (requestGenerationMode !== undefined && requestGenerationMode !== "web") {
      return NextResponse.json({ error: "Invalid generationMode" }, { status: 400 });
    }

    // For retry or pre-created project: load existing project's prompt and model
    let effectivePrompt = userPrompt as string | undefined;
    let effectiveModel = modelOverride;
    let effectiveGenerationMode = requestGenerationMode ?? "web";
    if (retryProjectId || preCreatedProjectId) {
      const lookupId = retryProjectId ?? preCreatedProjectId!;
      const existing = await getProject(db, lookupId);
      if (!existing) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      // For pre-created projects, use the stored prompt if none provided in body
      if (!effectivePrompt) effectivePrompt = existing.userPrompt;
      if (!effectiveModel && existing.modelId) effectiveModel = existing.modelId;
      effectiveGenerationMode = existing.generationMode ?? "web";
    }
    const promptProfile = normalizePromptProfile(effectiveGenerationMode);

    // Set runtime model
    if (effectiveModel) {
      setRuntimeModelId(effectiveModel as ModelId);
    }

    // Load step-level model overrides from DB (ensures they survive process restarts)
    await loadStepModelsFromDB();
    const corePromptOverrides = useDatabasePrompts
      ? await loadCoreStepPromptsFromDB(promptProfile)
      : new Map();

    if (!effectivePrompt || typeof effectivePrompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'userPrompt' field" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        // Step 1: Create or reuse project
        let projectId: string;
        let trajectory: { runId: string; taskId: string } | null = null;
        let trajectoryQueue: Promise<void> = Promise.resolve();
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
        const enqueueTrajectoryEvent = (
          event: Parameters<typeof appendTrajectoryEvent>[1]
        ) => {
          if (!trajectory) return;
          const runId = trajectory.runId;
          trajectoryQueue = trajectoryQueue
            .then(async () => {
              await appendTrajectoryEvent(runId, event);
            })
            .catch((err) => {
              console.warn("[AI API] trajectory append failed:", err);
            });
        };

        if (retryProjectId) {
          projectId = retryProjectId;
          // Clear stale buildSteps so old "active" nodes don't ghost in the UI
          await updateProjectStatus(db, projectId, "generating", { error: undefined, buildSteps: [] });
        } else if (preCreatedProjectId) {
          // Project already created by the client — just scaffold the dir
          projectId = preCreatedProjectId;
        } else {
          const project = await createProject(db, {
            userPrompt: effectivePrompt,
            userId: user.id,
            ownerUsername: getUserDisplayName(user),
            modelId: effectiveModel,
            folderId: folderId ?? null,
          });
          projectId = project.id;
        }

        try {
          try {
            const taskId = `project:${projectId}`;
            const run = await createTrajectoryRun({
              task_id: taskId,
              goal: effectivePrompt,
              task_spec_ref: "open-ox.generate-project",
              environment: {
                route: "/api/ai",
                project_id: projectId,
                mode: retryProjectId ? "retry" : preCreatedProjectId ? "precreated" : "new",
              },
              success_criteria: [
                "generation completed",
                "run has deterministic end state",
                "build verification status recorded",
              ],
              meta: {
                source: "api/ai",
                model: effectiveModel ?? null,
              },
            });
            trajectory = { runId: run.runId, taskId };
          } catch (err) {
            console.warn("[AI API] trajectory run creation failed:", err);
          }

          // Step 2: Scaffold project directory from template (skip for retry — dir already exists)
          if (!retryProjectId) {
            await initProjectDir(db, projectId);
          }

          // Step 2.5: Detect checkpoint for resume (retry or interrupted generation)
          let checkpoint: CheckpointResult | undefined;
          if (retryProjectId || preCreatedProjectId) {
            const existing = await getProject(db, projectId);
            if (existing && existing.buildSteps && existing.buildSteps.length > 0) {
              checkpoint = detectCheckpoint(existing);
              if (checkpoint.hasCheckpoint) {
                console.log(`[AI API] Checkpoint detected for ${projectId}: ${checkpoint.summary}`);
              }
            }
          }

          const langfuseSessionKey = resolveLangfuseSessionId({
            projectId,
            clientSessionId:
              typeof body.langfuseSessionId === "string" ? body.langfuseSessionId : undefined,
            trajectoryRunId: trajectory?.runId,
          });

          // Step 3: Run generation, writing files into sites/{projectId}/
          const result = await runWithLangfuseTraceRoot(
            {
              name: LfTrace.generateProject,
              userId: user.id,
              sessionId: langfuseSessionKey,
              tags: ["flow:generate_project", "route:api_ai"],
              metadata: {
                projectId,
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
                  runGenerateProject(
                    effectivePrompt,
                    (step: BuildStep) => {
              // SSE is the sole real-time channel — no DB writes during generation.
              // Final buildSteps are persisted once via updateProjectStatus below.
              send({ type: "step", ...redactBuildStepForTransport(step) });
              const phase = mapPhase(step.step);
              const summarizeError = (detail?: string) => {
                if (!detail) return "unknown_error";
                return detail.split("\n")[0]?.slice(0, 240) || "unknown_error";
              };

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

              if (activeRepairEpisode && step.step === "repair_build" && (step.status === "ok" || step.status === "error")) {
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

              if (activeRepairEpisode && step.step === "run_build" && (step.status === "ok" || step.status === "error")) {
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
            },
                {
                  projectId,
                  styleGuide,
                  enableSkills,
                  useDatabasePrompts,
                  checkpoint,
                  enableIntentGuide,
                  langfuseUserId: user.id,
                  langfuseSessionId: langfuseSessionKey,
                }
                  )
              )
          );

          if (result.success) {
            // Step 4: Mark project as ready (local disk already has files; E2B preview uses that).
            await updateProjectStatus(db, projectId, "ready", {
              completedAt: new Date().toISOString(),
              verificationStatus: result.verificationStatus,
              blueprint: result.blueprint,
              buildSteps: result.steps.map(redactBuildStepForTransport),
              generatedFiles: result.generatedFiles,
              logDirectory: result.logDirectory,
              totalDuration: result.totalDuration,
            });

            // Step 5: Update project name from blueprint's projectTitle
            const projectTitle = (result.blueprint as { brief?: { projectTitle?: string } })?.brief?.projectTitle;
            if (
              projectTitle &&
              projectTitle.trim() &&
              !shouldSkipNamingFromBlueprintTitle(projectTitle)
            ) {
              await renameProject(db, projectId, projectTitle.trim());
            }

            // Step 6: Persist to Storage asynchronously (does not block preview / SSE done).
            scheduleUploadFullProject(projectId);
            scheduleCaptureProjectCover(projectId);
          } else if (result.intentGuideDeferred && result.intentGuide) {
            await updateProjectStatus(db, projectId, "failed", {
              error:
                `[intent_guide] ${result.intentGuide.assistantMessage.slice(0, 480)}`,
              buildSteps: result.steps.map(redactBuildStepForTransport),
            });
          } else {
            // Generation completed but reported failure — still persist steps for debugging
            await updateProjectStatus(db, projectId, "failed", {
              error: result.error ?? "Generation failed",
              buildSteps: result.steps.map(redactBuildStepForTransport),
            });
          }

          // Build response content matching the legacy processInput shape
          const fileSummary = `生成了 ${result.generatedFiles.length} 个文件：\n${result.generatedFiles.join("\n")}`;
          const logSummary = result.logDirectory ? `\n\n日志目录：${result.logDirectory}` : "";
          const installedSummary =
            result.installedDependencies.length > 0
              ? `\n\n自动安装依赖：${result.installedDependencies.map((item) => item.packageName).join(", ")}`
              : "";
          const installFailureSummary =
            result.dependencyInstallFailures.length > 0
              ? `\n\n依赖安装失败：${result.dependencyInstallFailures
                  .map((item) => `${item.packageName} (${item.error})`)
                  .join("; ")}`
              : "";

          const content =
            result.intentGuideDeferred && result.intentGuide
              ? result.intentGuide.assistantMessage
              : result.success
                ? result.verificationStatus === "passed"
                  ? `项目构建完成并通过校验。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`
                  : `项目文件已写入正式目录，但当前未通过校验，相关生成文件已标记。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`
                : `项目生成失败：${result.error}`;

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

          send({
            type: "done",
            result: {
              content,
              projectId,
              generatedFiles: result.generatedFiles,
              blueprint: result.blueprint,
              verificationStatus: result.verificationStatus,
              unvalidatedFiles: result.unvalidatedFiles,
              installedDependencies: result.installedDependencies,
              dependencyInstallFailures: result.dependencyInstallFailures,
              buildSteps: result.steps.map(redactBuildStepForTransport),
              logDirectory: result.logDirectory,
              buildTotalDuration: result.totalDuration,
              intentGuideDeferred: result.intentGuideDeferred === true,
              intentGuide: result.intentGuide
                ? {
                    outcome: result.intentGuide.outcome,
                    phase: result.intentGuide.phase,
                    assistantMessage: result.intentGuide.assistantMessage,
                    suggestedReplies: result.intentGuide.suggestedReplies,
                    choiceOptions: result.intentGuide.choiceOptions,
                    buildPromptAppendix: result.intentGuide.buildPromptAppendix,
                  }
                : undefined,
            },
          });

          if (trajectory) {
            await trajectoryQueue;
            await createRunEndEvent(
              trajectory.runId,
              trajectory.taskId,
              "system",
              {
                success: result.success,
                verificationStatus: result.verificationStatus,
                error: result.error ?? null,
                generatedFiles: result.generatedFiles.length,
                projectId,
              }
            ).catch((err) => {
              console.warn("[AI API] trajectory run_end failed:", err);
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Internal error";
          // initProjectDir already sets status to "failed" on its own errors,
          // but we also handle runGenerateProject errors here.
          try {
            await updateProjectStatus(db, projectId, "failed", { error: message });
          } catch {
            // best-effort — don't mask the original error
          }
          send({ type: "error", message });
          if (trajectory) {
            await trajectoryQueue;
            await appendTrajectoryEvent(trajectory.runId, {
              task_id: trajectory.taskId,
              phase: "finalize",
              event_type: "error",
              actor: "system",
              payload: { message, projectId },
              meta: { source: "api_error" },
            }).catch(() => null);
            await createRunEndEvent(trajectory.runId, trajectory.taskId, "system", {
              success: false,
              verificationStatus: "failed",
              error: message,
              projectId,
            }).catch(() => null);
          }
        } finally {
          await flushLangfuse();
          setRuntimeModelId(null);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: SSE_RESPONSE_HEADERS,
    });
  } catch (err) {
    console.error("[AI API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
