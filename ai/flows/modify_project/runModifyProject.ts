import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setSiteRoot, clearSiteRoot } from "@/ai/tools/system/common";
import { getProject, getSiteRoot as pmGetSiteRoot, updateProjectStatus } from "@/lib/projectManager";
import type { ModificationRecord } from "@/lib/projectManager";
import { clearFileReadTracking } from "@/ai/tools";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";
import { setRevertSnapshots, clearRevertSnapshots } from "@/ai/tools/system/revertFileTool";
import { buildFileTree, buildHistoryContext, buildInitialMessages, tryReadFile } from "./context/buildContext";
import { FileSnapshotTracker, type DiffStats } from "./tracking/fileSnapshotTracker";
import { runAgentLoop } from "./engine/loopEngine";
import { SYSTEM_PROMPT } from "./prompt/systemPrompt";
import { appendTrajectoryEvent, findOrCreateTrajectoryRun } from "@/lib/trajectory/store";
import type { TrajectoryData } from "./trajectory";

type TrajectoryToolCall = NonNullable<TrajectoryData["messages"][number]["tool_calls"]>[number];
const ALL_TOOLS_FOR_TRAJECTORY = ["read_file", "search_code", "list_dir", "edit_file", "write_file", "run_build", "exec_shell", "think", "revert_file"];

export type ModifySSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> } }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; result: string }
  | { type: "thinking"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function runModifyProject(
  db: SupabaseClient,
  projectId: string,
  userInstruction: string,
  onEvent: (event: ModifySSEEvent) => void,
  conversationHistory?: Array<{ instruction: string; summary: string }>,
  clearContext = false,
  imageBase64?: string,
  modelOverride?: string
): Promise<void> {
  const artifactLogger = createArtifactLogger("modify_project");
  await artifactLogger.writeJson("run", "input", { projectId, userInstruction });

  onEvent({ type: "step", name: "resolve_project", status: "running" });
  const project = await getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const projectDir = pmGetSiteRoot(projectId);
  setSiteRoot(projectDir);
  onEvent({ type: "step", name: "resolve_project", status: "done" });
  const taskId = `modify:${projectId}`;
  let trajectory: { runId: string; taskId: string } | null = null;
  let trajectoryQueue: Promise<void> = Promise.resolve();
  let repairEpisodeSeq = 0;
  let activeRepairEpisode: {
    episodeId: string;
    triggerTool: string;
    errorSummary: string;
    startedAt: number;
    actionStarted: boolean;
    latestBuildStatus: "ok" | "error" | "unknown";
  } | null = null;
  const enqueueTrajectoryEvent = (
    event: Parameters<typeof appendTrajectoryEvent>[1]
  ) => {
    if (!trajectory) return;
    trajectoryQueue = trajectoryQueue
      .then(async () => {
        await appendTrajectoryEvent(trajectory!.runId, event);
      })
      .catch((err) => {
        console.warn("[modify] trajectory append failed:", err);
      });
  };

  try {
    try {
      const run = await findOrCreateTrajectoryRun({
        task_id: taskId,
        goal: userInstruction,
        task_spec_ref: "open-ox.modify-project",
        environment: {
          route: "/api/projects/[id]/modify",
          project_id: projectId,
          mode: "modify",
        },
        success_criteria: [
          "modification applied or explicitly no-op",
          "build verification result recorded",
        ],
        meta: { source: "modify_project_flow", model: modelOverride ?? null },
      });
      trajectory = { runId: run.runId, taskId };
      const episodeId = `${projectId}-modify-repair-${++repairEpisodeSeq}`;
      activeRepairEpisode = {
        episodeId,
        triggerTool: "requirement_mismatch",
        errorSummary: userInstruction.slice(0, 240),
        startedAt: Date.now(),
        actionStarted: false,
        latestBuildStatus: "unknown",
      };
      enqueueTrajectoryEvent({
        task_id: taskId,
        phase: "execution",
        event_type: "repair_episode_started",
        actor: "system",
        payload: {
          episode_id: episodeId,
          trigger_step: "requirement_mismatch",
          error_summary: activeRepairEpisode.errorSummary,
          error_detail: userInstruction,
        },
        meta: { source: "modify_repair_episode" },
      });
    } catch (err) {
      console.warn("[modify] trajectory run creation failed:", err);
    }

    onEvent({ type: "step", name: "read_context", status: "running" });
    const fileTree = await buildFileTree(projectDir);
    const designSystem = (await tryReadFile(path.join(projectDir, "design-system.md"))) ?? "";
    const globalsCss = (await tryReadFile(path.join(projectDir, "app/globals.css"))) ?? "";
    onEvent({ type: "step", name: "read_context", status: "done" });

    onEvent({ type: "step", name: "agent_loop", status: "running" });
    const tracker = new FileSnapshotTracker(projectDir);
    setRevertSnapshots(tracker.snapshotMap);

    const collectedToolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];
    const collectedThinking: string[] = [];
    const collectingOnEvent = (event: ModifySSEEvent) => {
      if (event.type === "tool_call") {
        collectedToolCalls.push({ tool: event.tool, args: event.args, result: event.result });
        const toolPhase = event.tool === "run_build" ? "verification" : "execution";
        enqueueTrajectoryEvent({
          task_id: taskId,
          phase: toolPhase,
          event_type: "shell_command",
          actor: "tool",
          payload: {
            tool: event.tool,
            args: event.args,
          },
          meta: { source: "modify_tool_call" },
        });
        enqueueTrajectoryEvent({
          task_id: taskId,
          phase: toolPhase,
          event_type: "shell_result",
          actor: "tool",
          payload: {
            tool: event.tool,
            result: event.result,
            success: !/failed|error|no overload matches|cannot find|type error/i.test(event.result),
          },
          meta: { source: "modify_tool_call" },
        });

        if (event.tool === "run_build") {
          const failed = /failed|error|no overload matches|cannot find|type error/i.test(event.result);
          if (failed) {
            if (activeRepairEpisode) {
              activeRepairEpisode.latestBuildStatus = "error";
            }
          } else if (activeRepairEpisode) {
            activeRepairEpisode.latestBuildStatus = "ok";
            enqueueTrajectoryEvent({
              task_id: taskId,
              phase: "verification",
              event_type: "repair_verification_result",
              actor: "system",
              payload: {
                episode_id: activeRepairEpisode.episodeId,
                verification_step: "run_build",
                status: "ok",
                detail: event.result,
              },
              meta: { source: "modify_repair_episode" },
            });
            enqueueTrajectoryEvent({
              task_id: taskId,
              phase: "finalize",
              event_type: "repair_episode_finished",
              actor: "system",
              payload: {
                episode_id: activeRepairEpisode.episodeId,
                outcome: "resolved",
                trigger_step: activeRepairEpisode.triggerTool,
                started_at: activeRepairEpisode.startedAt,
                ended_at: Date.now(),
              },
              meta: { source: "modify_repair_episode" },
            });
            activeRepairEpisode = null;
          }
        } else if (activeRepairEpisode && (event.tool === "edit_file" || event.tool === "write_file")) {
          if (!activeRepairEpisode.actionStarted) {
            activeRepairEpisode.actionStarted = true;
            enqueueTrajectoryEvent({
              task_id: taskId,
              phase: "execution",
              event_type: "repair_action_started",
              actor: "agent",
              payload: {
                episode_id: activeRepairEpisode.episodeId,
                action: "apply_patch",
              },
              meta: { source: "modify_repair_episode" },
            });
          }
          enqueueTrajectoryEvent({
            task_id: taskId,
            phase: "execution",
            event_type: "repair_action_result",
            actor: "agent",
            payload: {
              episode_id: activeRepairEpisode.episodeId,
              action: event.tool,
              status: "ok",
              detail: event.result.slice(0, 500),
            },
            meta: { source: "modify_repair_episode" },
          });
        }
      } else if (event.type === "thinking") {
        collectedThinking.push(event.content);
      }
      if (event.type === "step") {
        enqueueTrajectoryEvent({
          task_id: taskId,
          phase: "execution",
          event_type: "checkpoint",
          actor: "agent",
          payload: {
            step: event.name,
            status: event.status,
            detail: event.message ?? null,
          },
          meta: { source: "modify_step" },
        });
      }
      onEvent(event);
    };

    const dbHistory = clearContext
      ? []
      : (project.modificationHistory ?? []).map((r) => ({
        instruction: r.instruction,
        summary: r.plan?.analysis
          ? `${r.plan.analysis} Files: ${r.touchedFiles.join(", ")}`
          : `Modified ${r.touchedFiles.length} file(s): ${r.touchedFiles.join(", ")}`,
      }));
    const sessionHistory = conversationHistory ?? [];
    const historyContext = buildHistoryContext(dbHistory, sessionHistory);
    const messages = buildInitialMessages({
      systemPrompt: SYSTEM_PROMPT,
      userInstruction,
      historyContext,
      fileTree,
      designSystem,
      globalsCss,
      imageBase64,
    });

    const { loopState, iterations } = await runAgentLoop(
      messages,
      tracker,
      collectingOnEvent as (event: { type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error";[key: string]: unknown }) => void,
      userInstruction,
      modelOverride
    );
    collectingOnEvent({
      type: "step",
      name: "agent_loop",
      status: loopState.buildPassed ? "done" : loopState.hasEdited ? "error" : "done",
      message: `${iterations} iterations, edited=${loopState.hasEdited}, build=${loopState.buildPassed ? "passed" : "failed"}`,
    });

    const diffs = await tracker.computeAllDiffs();
    for (const d of diffs) {
      onEvent({ type: "diff", file: d.file, reasoning: userInstruction, patch: d.patch, stats: d.stats });
    }

    const allThinking = messages
      .filter((m) => m.role === "assistant" && typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => (m.content as string).trim())
      .join("\n\n");

    const analysisText =
      diffs.length > 0
        ? `Agent made ${diffs.length} file change(s) in ${iterations} iterations.`
        : allThinking.length > 0
          ? allThinking.slice(0, 2000)
          : `Agent ran ${iterations} iterations but made no changes. The LLM did not provide an explanation.`;

    onEvent({
      type: "plan",
      plan: {
        analysis: analysisText,
        changes: diffs.map((d) => ({
          path: d.file,
          action: "modify",
          reasoning: `+${d.stats.additions} -${d.stats.deletions}`,
        })),
      },
    });

    onEvent({ type: "step", name: "update_registry", status: "running" });
    const touchedFiles = diffs.map((d) => d.file);
    const record: ModificationRecord = {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles,
      plan: {
        analysis: `${diffs.length} file(s) modified`,
        changes: diffs.map((d) => ({
          path: d.file,
          action: "modify",
          reasoning: `+${d.stats.additions} -${d.stats.deletions}`,
        })),
      },
      diffs: diffs.map((d) => ({
        file: d.file,
        reasoning: userInstruction,
        patch: d.patch,
        stats: d.stats,
      })),
      toolCalls: collectedToolCalls.map((tc) => ({
        tool: tc.tool,
        args: tc.args,
        result: tc.result.slice(0, 500),
      })),
      thinking: collectedThinking.map((t) => t.slice(0, 500)),
      image: imageBase64 ? (imageBase64.length > 200_000 ? imageBase64.slice(0, 200_000) : imageBase64) : null,
    };
    const existingHistory = project.modificationHistory ?? [];
    await updateProjectStatus(db, projectId, "ready", {
      modificationHistory: [...existingHistory, record],
      verificationStatus: loopState.buildPassed ? "passed" : "failed",
    });
    onEvent({
      type: "step",
      name: "update_registry",
      status: "done",
      message: `${touchedFiles.length} file(s): ${touchedFiles.join(", ")}`,
    });
    if (activeRepairEpisode) {
      const requirementResolved = touchedFiles.length > 0;
      const verificationPassed = loopState.buildPassed || activeRepairEpisode.latestBuildStatus === "ok";
      enqueueTrajectoryEvent({
        task_id: taskId,
        phase: "finalize",
        event_type: "repair_episode_finished",
        actor: "system",
        payload: {
          episode_id: activeRepairEpisode.episodeId,
          outcome: requirementResolved && verificationPassed ? "resolved" : "unresolved",
          trigger_step: activeRepairEpisode.triggerTool,
          requirement_resolved: requirementResolved,
          verification_passed: verificationPassed,
          touched_files: touchedFiles.length,
          started_at: activeRepairEpisode.startedAt,
          ended_at: Date.now(),
        },
        meta: { source: "modify_repair_episode" },
      });
      activeRepairEpisode = null;
    }

    await artifactLogger.writeJson("run", "result", {
      projectId,
      instruction: userInstruction,
      touchedFiles,
      buildPassed: loopState.buildPassed,
      iterations,
    });

    // Save conversation trajectory to local filesystem
    try {
      const { saveTrajectory } = await import("./trajectory");
      await saveTrajectory({
        meta: {
          projectId,
          instruction: userInstruction,
          model: modelOverride ?? "default",
          tools: ALL_TOOLS_FOR_TRAJECTORY,
          skills: [],
          iterations,
          buildPassed: loopState.buildPassed,
          touchedFiles,
          diffs: diffs.map(d => ({ file: d.file, stats: d.stats })),
          timestamp: new Date().toISOString(),
        },
        messages: messages.map(m => ({
          role: m.role as "system" | "user" | "assistant" | "tool",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          tool_calls: m.tool_calls as TrajectoryToolCall[] | undefined,
          tool_call_id: m.tool_call_id,
          reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
        })),
      });
    } catch (trajErr) {
      console.warn("[modify] trajectory save failed:", trajErr);
    }

    if (trajectory) {
      await trajectoryQueue;
      // Don't end the run — keep it open for future modify rounds on the same project.
      // Record a checkpoint instead so the run accumulates all modify rounds.
      await appendTrajectoryEvent(trajectory.runId, {
        task_id: trajectory.taskId,
        phase: "finalize",
        event_type: "checkpoint",
        actor: "system",
        payload: {
          type: "modify_round_complete",
          success: true,
          verificationStatus: loopState.buildPassed ? "passed" : "failed",
          projectId,
          touchedFiles: touchedFiles.length,
          iterations,
        },
        meta: { source: "modify_round_end" },
      }).catch((err) => {
        console.warn("[modify] trajectory round checkpoint failed:", err);
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "step", name: "agent_loop", status: "error", message: errMsg });
    onEvent({ type: "error", message: errMsg });
    if (activeRepairEpisode) {
      enqueueTrajectoryEvent({
        task_id: taskId,
        phase: "finalize",
        event_type: "repair_episode_finished",
        actor: "system",
        payload: {
          episode_id: activeRepairEpisode.episodeId,
          outcome: "unresolved",
          trigger_step: activeRepairEpisode.triggerTool,
          started_at: activeRepairEpisode.startedAt,
          ended_at: Date.now(),
        },
        meta: { source: "modify_repair_episode" },
      });
      activeRepairEpisode = null;
    }
    if (trajectory) {
      await trajectoryQueue;
      await appendTrajectoryEvent(trajectory.runId, {
        task_id: trajectory.taskId,
        phase: "finalize",
        event_type: "error",
        actor: "system",
        payload: { message: errMsg, projectId },
        meta: { source: "modify_error" },
      }).catch(() => null);
      // Don't end the run on error — keep it open for retry/future modify rounds.
      await appendTrajectoryEvent(trajectory.runId, {
        task_id: trajectory.taskId,
        phase: "finalize",
        event_type: "checkpoint",
        actor: "system",
        payload: {
          type: "modify_round_complete",
          success: false,
          error: errMsg,
          projectId,
        },
        meta: { source: "modify_round_end" },
      }).catch(() => null);
    }
  } finally {
    clearRevertSnapshots();
    clearFileReadTracking();
    clearSiteRoot();
  }
}
