import path from "path";
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

export type ModifySSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> } }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; result: string }
  | { type: "thinking"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function runModifyProject(
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
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const projectDir = pmGetSiteRoot(projectId);
  setSiteRoot(projectDir);
  onEvent({ type: "step", name: "resolve_project", status: "done" });

  try {
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
      } else if (event.type === "thinking") {
        collectedThinking.push(event.content);
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
      collectingOnEvent as (event: { type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error"; [key: string]: unknown }) => void,
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
    await updateProjectStatus(projectId, "ready", {
      modificationHistory: [...existingHistory, record],
      verificationStatus: loopState.buildPassed ? "passed" : "failed",
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
    clearFileReadTracking();
    clearSiteRoot();
  }
}
