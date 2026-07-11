import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runWithSiteRoot } from "@/ai/tools/system/common";
import { getProject, getSiteRoot as pmGetSiteRoot, updateProjectStatus } from "@/lib/projectManager";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import type { ModificationRecord } from "@/lib/projectManager";
import { clearFileTracking } from "@/ai/tools";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";
import { setRevertSnapshots, clearRevertSnapshots } from "@/ai/tools/system/revertFileTool";
import { buildFileTree, buildInitialMessages, tryReadFile } from "./context/buildContext";
import { loadPreloadedFileContents } from "./context/loadPreloadedFileContents";
import { FileSnapshotTracker, type DiffStats } from "./tracking/fileSnapshotTracker";
import { runAgentLoop } from "./engine/loopEngine";
import { runFinalVerification } from "./engine/verification";
import { runModifyPlanPhase } from "./engine/planPhase";
import {
  extractLastAssistantMessage,
  runModifyCompletionSummary,
} from "./engine/completionSummary";
import { resolveModifyProfile, withAllowedTargets } from "./profile/modifyProfile";
import { withLangfuseSpan } from "@/lib/observability/langfuseTracing";
import { LfSpanModify } from "@/lib/observability/langfuseTraceCatalog";
import {
  stepModifyIntentRouter,
  type ModifyIntentCategory,
} from "./intent/modifyIntentRouter";
import { buildModifyWorkingMemoryContext } from "./history/modifyWorkingMemory";
import {
  fromModificationRecord,
  mergeModifyHistoryTurns,
  type ModifyHistoryTurn,
} from "./history/modifyHistoryTurn";
import {
  applyContinuationRoutingOverrides,
  detectContinuationReply,
  mergeContinuationInstruction,
} from "./intent/modifyContinuation";
import { createImageExecutor, awaitPendingImages, type PendingImage } from "@/ai/tools/system/generateImageTool";
import type { ToolExecutor } from "@/ai/tools/types";
import type { ModifyPlan } from "./engine/planPhase";

const MODIFY_INTENT_CONVERSATION_FALLBACK =
  "我是项目助手：可以回答关于当前站点的问题、帮你制定修改计划，或直接改代码。需要改页面时，请说明要改哪里、改成什么样。";

function formatPlanOnlyAnalysis(plan: ModifyPlan): string {
  const summary = plan.summary.trim();
  const fileBlock =
    plan.targetFiles.length > 0
      ? `\n\n**建议涉及的文件：**\n${plan.targetFiles.map((f) => `- \`${f}\``).join("\n")}`
      : "";
  return `${summary}${fileBlock}\n\n---\n确认执行请说「按这个计划修改」，或指定要先做哪几项。`;
}

async function persistModifyRound(
  db: SupabaseClient,
  projectId: string,
  existingHistory: ModificationRecord[],
  record: ModificationRecord
): Promise<void> {
  await updateProjectStatus(db, projectId, "ready", {
    modificationHistory: [...existingHistory, record],
    verificationStatus: "passed",
  });
}

function assistantLabel(category: ModifyIntentCategory): string {
  switch (category) {
    case "conversation":
      return "对话";
    case "read_only":
      return "问答";
    case "plan_only":
      return "规划";
    default:
      return "修改";
  }
}

export type ModifySSEEvent =
  | { type: "intent"; category: ModifyIntentCategory; label: string }
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> }; intentCategory?: ModifyIntentCategory }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; result: string }
  | { type: "thinking"; content: string }
  | { type: "credits"; charged: number; usd: number }
  | { type: "done" }
  | { type: "error"; message: string };

export async function runModifyProject(
  db: SupabaseClient,
  projectId: string,
  userInstruction: string,
  onEvent: (event: ModifySSEEvent) => void,
  conversationHistory?: ModifyHistoryTurn[],
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
  return runWithSiteRoot(projectDir, () => runModifyProjectInner(
    db,
    project,
    projectId,
    userInstruction,
    onEvent,
    conversationHistory,
    clearContext,
    imageBase64,
    modelOverride,
    artifactLogger,
  ));
}

type ModifyArtifactLogger = ReturnType<typeof createArtifactLogger>;

async function runModifyProjectInner(
  db: SupabaseClient,
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>,
  projectId: string,
  userInstruction: string,
  onEvent: (event: ModifySSEEvent) => void,
  conversationHistory: ModifyHistoryTurn[] | undefined,
  clearContext: boolean,
  imageBase64: string | undefined,
  modelOverride: string | undefined,
  artifactLogger: ModifyArtifactLogger,
): Promise<void> {
  const projectDir = pmGetSiteRoot(projectId);
  onEvent({ type: "step", name: "resolve_project", status: "done" });

  onEvent({ type: "step", name: "read_context", status: "running" });
  const fileTree = await buildFileTree(projectDir);
  const designSystem = (await tryReadFile(path.join(projectDir, "design-system.md"))) ?? "";
  const globalsCss = (await tryReadFile(path.join(projectDir, "app/globals.css"))) ?? "";
  onEvent({ type: "step", name: "read_context", status: "done" });

  const dbHistory: ModifyHistoryTurn[] = clearContext
    ? []
    : (project.modificationHistory ?? []).map(fromModificationRecord);
  const sessionHistory = conversationHistory ?? [];
  const mergedHistory = mergeModifyHistoryTurns(dbHistory, sessionHistory);
  const workingMemory = buildModifyWorkingMemoryContext(dbHistory, sessionHistory);

  const isContinuation = detectContinuationReply(userInstruction, mergedHistory);
  const effectiveInstruction = isContinuation
    ? mergeContinuationInstruction(userInstruction, mergedHistory)
    : userInstruction;

  onEvent({ type: "step", name: "intent_router", status: "running" });
  let routed: Awaited<ReturnType<typeof stepModifyIntentRouter>> = {
    category: "read_only",
    scope: "narrow",
    preloadPaths: [],
    assistantMessage: "",
  };
  try {
    routed = await withLangfuseSpan(
      LfSpanModify.intentRouter,
      () =>
        stepModifyIntentRouter(effectiveInstruction, {
          fileTree,
          workingMemoryBlock: workingMemory.routerPromptBlock,
        }),
      { metadata: { projectId, continuation: isContinuation } }
    );
  } catch (err) {
    console.warn("[modify] intent_router failed, defaulting to read_only:", err);
    routed = { category: "read_only", scope: "narrow", preloadPaths: [], assistantMessage: "" };
  }

  routed = applyContinuationRoutingOverrides(routed, {
    isContinuation,
    recentHistory: mergedHistory,
    originalInstruction: userInstruction,
  });
  onEvent({ type: "intent", category: routed.category, label: assistantLabel(routed.category) });
  onEvent({
    type: "step",
    name: "intent_router",
    status: "done",
    message: `${routed.category} scope=${routed.scope}${isContinuation ? " continuation" : ""}`,
  });

  if (routed.category === "conversation") {
    const reply = routed.assistantMessage.trim() || MODIFY_INTENT_CONVERSATION_FALLBACK;
    onEvent({ type: "step", name: "agent_loop", status: "running" });
    onEvent({ type: "thinking", content: reply });
    onEvent({
      type: "step",
      name: "agent_loop",
      status: "done",
      message: "0 iterations (conversation only, no tools)",
    });
    onEvent({
      type: "plan",
      intentCategory: "conversation",
      plan: {
        analysis: reply,
        changes: [],
      },
    });
    await persistModifyRound(db, projectId, project.modificationHistory ?? [], {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles: [],
      intentCategory: "conversation",
      plan: { analysis: reply, changes: [] },
      thinking: [reply],
      image: imageBase64 ?? null,
    });
    await artifactLogger.writeJson("run", "result", {
      projectId,
      instruction: userInstruction,
      intent: "conversation",
      touchedFiles: [],
      buildPassed: false,
      iterations: 0,
    });
    clearRevertSnapshots();
    clearFileTracking();
    return;
  }

  const preloadedFiles = await loadPreloadedFileContents(projectDir, routed.preloadPaths, fileTree);

  if (routed.category === "plan_only") {
    onEvent({ type: "step", name: "modify_plan", status: "running" });
    const plan = await withLangfuseSpan(
      LfSpanModify.agentLoop,
      () =>
        runModifyPlanPhase({
          userInstruction: effectiveInstruction,
          fileTree,
          preloadedFiles,
        }),
      { metadata: { projectId, phase: "plan_only" } }
    );
    const analysis = formatPlanOnlyAnalysis(plan);
    onEvent({
      type: "step",
      name: "modify_plan",
      status: "done",
      message: plan.targetFiles.join(", ") || "no targets",
    });
    onEvent({ type: "step", name: "agent_loop", status: "done", message: "0 iterations (plan only)" });
    onEvent({
      type: "plan",
      intentCategory: "plan_only",
      plan: {
        analysis,
        changes: plan.targetFiles.map((f) => ({
          path: f,
          action: "plan",
          reasoning: "Planned target — not executed until you confirm",
        })),
      },
    });
    await persistModifyRound(db, projectId, project.modificationHistory ?? [], {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles: [],
      intentCategory: "plan_only",
      plan: {
        analysis,
        changes: plan.targetFiles.map((f) => ({
          path: f,
          action: "plan",
          reasoning: "Planned target",
        })),
      },
      image: imageBase64 ?? null,
    });
    await artifactLogger.writeJson("run", "result", {
      projectId,
      instruction: userInstruction,
      intent: "plan_only",
      touchedFiles: [],
      buildPassed: false,
      iterations: 0,
    });
    clearRevertSnapshots();
    clearFileTracking();
    return;
  }

  const modifyStopMode = routed.category === "read_only" ? "read_only" : "code_change";
  let profile = resolveModifyProfile(routed);

  let planSummary: string | undefined;
  if (profile.usePlannedWideFlow) {
    onEvent({ type: "step", name: "modify_plan", status: "running" });
    const plan = await withLangfuseSpan(
      LfSpanModify.agentLoop,
      () =>
        runModifyPlanPhase({
          userInstruction: effectiveInstruction,
          fileTree,
          preloadedFiles,
        }),
      { metadata: { projectId, phase: "plan" } }
    );
    planSummary = plan.summary;
    if (plan.targetFiles.length > 0) {
      profile = withAllowedTargets(profile, plan.targetFiles);
    }
    onEvent({
      type: "step",
      name: "modify_plan",
      status: "done",
      message: plan.targetFiles.join(", ") || "no targets",
    });
  }

  try {
    onEvent({ type: "step", name: "agent_loop", status: "running" });
    const tracker = new FileSnapshotTracker(projectDir);
    setRevertSnapshots(tracker.snapshotMap);

    const collectedToolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];
    const collectedThinking: string[] = [];
    const collectingOnEvent = (event: ModifySSEEvent) => {
      if (event.type === "tool_call") {
        collectedToolCalls.push({ tool: event.tool, args: event.args, result: event.result });
      } else if (event.type === "thinking") {
        collectedThinking.push(event.content);
      }
      onEvent(event);
    };

    const historyContext = workingMemory.agentPromptBlock;
    const messages = buildInitialMessages({
      modifyCategory: routed.category,
      userInstruction: effectiveInstruction,
      historyContext,
      fileTree,
      designSystem,
      globalsCss,
      imageBase64,
      preloadedFiles,
      planSummary,
    });

    let pendingImages: PendingImage[] = [];
    let toolOverrides: Record<string, ToolExecutor> | undefined;
    if (modifyStopMode === "code_change") {
      const bundle = createImageExecutor("modify");
      pendingImages = bundle.pendingImages;
      toolOverrides = { generate_image: bundle.executor };
    }

    const { loopState, iterations } = await withLangfuseSpan(
      LfSpanModify.agentLoop,
      () =>
        runAgentLoop(
          messages,
          tracker,
          collectingOnEvent as (event: { type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error";[key: string]: unknown }) => void,
          effectiveInstruction,
          modelOverride,
          modifyStopMode,
          {
            profile,
            toolOverrides,
            pendingImages,
            includeImageTools: modifyStopMode === "code_change",
          }
        ),
      { metadata: { projectId, scope: profile.scope } }
    );

    if (profile.allowEdits && loopState.hasEdited && loopState.touchedFiles.length > 0) {
      onEvent({ type: "step", name: "final_verification", status: "running" });
      const finalVerify = await runFinalVerification(profile, loopState.touchedFiles, {
        projectId,
      });
      loopState.hasBuild = !finalVerify.skippedBuild;
      loopState.buildPassed = finalVerify.buildPassed;
      loopState.lastBuildOutput = finalVerify.buildOutput;
      onEvent({
        type: "step",
        name: "final_verification",
        status: finalVerify.buildPassed ? "done" : "error",
        message: finalVerify.skippedBuild ? "scoped tsc only" : "full build",
      });
    }

    collectingOnEvent({
      type: "step",
      name: "agent_loop",
      status:
        modifyStopMode === "read_only"
          ? "done"
          : loopState.buildPassed
            ? "done"
            : loopState.hasEdited
              ? "error"
              : "done",
      message: `${iterations} iterations, edited=${loopState.hasEdited}, build=${loopState.buildPassed ? "passed" : loopState.hasEdited ? "failed" : "skipped"}`,
    });

    if (pendingImages.length > 0) {
      await awaitPendingImages(pendingImages);
    }

    const diffs = await tracker.computeAllDiffs();
    const imageDiffEntries = pendingImages
      .filter((p) => p.success)
      .map((p) => ({
        file: `public/images/${p.filename}.png`,
        reasoning: userInstruction,
        patch: `(generated image) ${p.prompt.slice(0, 400)}`,
        stats: { additions: 1, deletions: 0 },
      }))
      .filter((e) => !diffs.some((d) => d.file === e.file));

    for (const img of imageDiffEntries) {
      onEvent({
        type: "diff",
        file: img.file,
        reasoning: img.reasoning,
        patch: img.patch,
        stats: img.stats,
      });
    }
    for (const d of diffs) {
      onEvent({ type: "diff", file: d.file, reasoning: userInstruction, patch: d.patch, stats: d.stats });
    }

    const allRecordDiffs = [...imageDiffEntries, ...diffs];

    if (allRecordDiffs.length > 0) {
      try {
        await syncLocalProjectFingerprint(db, projectId);
      } catch (fpErr) {
        console.warn("[modify] syncLocalProjectFingerprint failed:", fpErr);
      }
    }

    const allThinking = messages
      .filter((m) => m.role === "assistant" && typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => (m.content as string).trim())
      .join("\n\n");

    const lastAssistantText = extractLastAssistantMessage(messages);
    const buildSkipped = !loopState.hasEdited || modifyStopMode === "read_only";

    onEvent({ type: "step", name: "modify_summary", status: "running" });
    const analysisText = await withLangfuseSpan(
      LfSpanModify.completionSummary,
      () =>
        runModifyCompletionSummary({
          userInstruction: effectiveInstruction,
          modifyMode: modifyStopMode,
          diffs: allRecordDiffs.map((d) => ({ file: d.file, stats: d.stats })),
          iterations,
          buildPassed: loopState.buildPassed,
          buildSkipped,
          assistantNotes: lastAssistantText || allThinking.slice(-2500),
        }),
      { metadata: { projectId, diffCount: allRecordDiffs.length } }
    );
    onEvent({
      type: "step",
      name: "modify_summary",
      status: "done",
      message: `${analysisText.length} chars`,
    });

    onEvent({
      type: "plan",
      intentCategory: routed.category,
      plan: {
        analysis: analysisText,
        changes: allRecordDiffs.map((d) => ({
          path: d.file,
          action: "modify",
          reasoning: `+${d.stats.additions} -${d.stats.deletions}`,
        })),
      },
    });

    onEvent({ type: "step", name: "update_registry", status: "running" });
    const touchedFiles = allRecordDiffs.map((d) => d.file);
    const record: ModificationRecord = {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles,
      intentCategory: routed.category,
      plan: {
        analysis: analysisText,
        changes: allRecordDiffs.map((d) => ({
          path: d.file,
          action: "modify",
          reasoning: `+${d.stats.additions} -${d.stats.deletions}`,
        })),
      },
      diffs: allRecordDiffs.map((d) => ({
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
      verificationStatus:
        modifyStopMode === "read_only" || !loopState.hasEdited || loopState.buildPassed
          ? "passed"
          : "failed",
    });
    onEvent({
      type: "step",
      name: "update_registry",
      status: "done",
      message: `${touchedFiles.length} file(s): ${touchedFiles.join(", ")}`,
    });
    await artifactLogger.writeJson("run", "result", {
      projectId,
      instruction: userInstruction,
      touchedFiles,
      buildPassed: loopState.buildPassed,
      iterations,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "step", name: "agent_loop", status: "error", message: errMsg });
    onEvent({ type: "error", message: errMsg });
  } finally {
    clearRevertSnapshots();
    clearFileTracking();
  }
}
