import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import type { ToolExecutor } from "@/ai/tools/types";
import { chatCompletion, type ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import { lfModifyAgentRound } from "@/lib/observability/langfuseGenerationCatalog";
import {
  createSpawnSubagentTool,
  SPAWN_SUBAGENT_TOOL_NAME,
} from "@/ai/shared/subagent";
import type { FileSnapshotTracker } from "../tracking/fileSnapshotTracker";
import type { ModifyProfile } from "../profile/modifyProfile";
import { toolNamesForProfile } from "../profile/modifyProfile";
import { runStopHook, type LoopState, type ModifyStopMode } from "./stopHooks";
import { compressContext } from "./contextCompression";
import { awaitPendingImages, type PendingImage } from "@/ai/tools/system/generateImageTool";
import { createProfiledToolExecutor } from "./toolGate";

const MAX_STOP_HOOK_RETRIES = 5;

type OnEvent = (event: {
  type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error";
  [key: string]: unknown;
}) => void;

export type RunAgentLoopOptions = {
  profile: ModifyProfile;
  toolOverrides?: Record<string, ToolExecutor>;
  pendingImages?: PendingImage[];
  includeImageTools?: boolean;
  /** When false, omit spawn_subagent. Default true. */
  enableSubagents?: boolean;
};

function createInitialLoopState(): LoopState {
  return {
    hasEdited: false,
    hasSearched: false,
    hasBuild: false,
    buildPassed: false,
    lastBuildOutput: "",
    fileReadCounts: new Map(),
    fileEditCounts: new Map(),
    consecutiveSameFileOps: 0,
    lastOperatedFile: null,
    phase: "orient",
    touchedFiles: [],
    openTypeErrors: 0,
    hasScopedTsc: false,
    scopedTscPassed: false,
  };
}

function countTypeErrorsFromToolResult(result: unknown): number {
  if (typeof result !== "object" || !result) return 0;
  const out = "output" in result && typeof result.output === "string" ? result.output : "";
  const err = "error" in result && typeof result.error === "string" ? result.error : "";
  const text = `${out}\n${err}`;
  if (!/Type-check found|error TS\d+/i.test(text)) return 0;
  if (typeof result === "object" && "success" in result && result.success === true) return 0;
  return 1;
}

export async function runAgentLoop(
  messages: ChatMessage[],
  tracker: FileSnapshotTracker,
  onEvent: OnEvent,
  userInstruction: string,
  modelOverride: string | undefined,
  modifyStopMode: ModifyStopMode,
  loopOptions: RunAgentLoopOptions
): Promise<{ messages: ChatMessage[]; loopState: LoopState; iterations: number }> {
  const profile = loopOptions.profile;
  const enableSubagents = loopOptions.enableSubagents !== false;
  const toolNameList = toolNamesForProfile(profile, {
    includeImageTools: loopOptions.includeImageTools === true,
  }).filter((name) => enableSubagents || name !== SPAWN_SUBAGENT_TOOL_NAME);
  const model = modelOverride || profile.modelId;
  const catalogNames = toolNameList.filter((name) => name !== SPAWN_SUBAGENT_TOOL_NAME);
  const tools = [...getSystemToolDefinitions(catalogNames)];
  const toolOverrides: Record<string, ToolExecutor> = {
    ...loopOptions.toolOverrides,
  };

  if (enableSubagents && toolNameList.includes(SPAWN_SUBAGENT_TOOL_NAME)) {
    const { tool: spawnTool, execute: spawnExecute } = createSpawnSubagentTool({
      allowedKinds: ["explore"],
      model,
      onEvent: (event) => {
        if (event.type === "thinking") {
          onEvent({
            type: "thinking",
            content: event.content,
            subagentKind: event.subagentKind,
          });
          return;
        }
        onEvent({
          type: "tool_call",
          tool: event.tool,
          args: event.args,
          result: event.result,
          subagentKind: event.subagentKind,
        });
      },
    });
    tools.push(spawnTool);
    toolOverrides[SPAWN_SUBAGENT_TOOL_NAME] = spawnExecute;
  }

  const loopState = createInitialLoopState();
  const touchedFiles = new Set<string>();
  const profiledExecute = createProfiledToolExecutor(profile, touchedFiles);

  let iterations = 0;
  let stopHookRetries = 0;
  let lastTransition: "initial" | "stop_hook_retry" | "tool_execution" = "initial";
  const maxIterations = profile.maxIterations;

  while (iterations < maxIterations) {
    iterations++;
    compressContext(messages, loopState);

    const toolChoice =
      iterations === 1 || lastTransition === "stop_hook_retry" ? ("required" as const) : ("auto" as const);

    let res;
    const MAX_LLM_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
      try {
        res = await chatCompletion({
          model,
          messages,
          temperature: 0.1,
          tools,
          tool_choice: toolChoice,
          parallel_tool_calls: true,
          langfuseGenerationName: lfModifyAgentRound(iterations, attempt),
          langfuseGenerationMetadata: {
            modifyLoopIteration: iterations,
            llmAttempt: attempt,
            modifyScope: profile.scope,
          },
        });
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRetryable = /400|429|500|502|503|504|ETIMEDOUT|ECONNRESET|Thought signature/i.test(errMsg);
        if (isRetryable && attempt < MAX_LLM_RETRIES) {
          const delayMs = 1000 * (attempt + 1);
          onEvent({
            type: "thinking",
            content: `[LLM Retry] Attempt ${attempt + 1} failed: ${errMsg.slice(0, 200)}. Retrying...`,
          });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        onEvent({ type: "thinking", content: `[LLM Error] ${errMsg}` });
        res = null;
        break;
      }
    }
    if (!res) break;

    const choice = res.choices?.[0];
    if (!choice?.message) break;
    const msg = choice.message;
    messages.push(msg as unknown as ChatMessage);

    if (msg.content && msg.content.trim()) {
      onEvent({ type: "thinking", content: msg.content });
    }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      loopState.touchedFiles = [...touchedFiles];
      const blockingError = runStopHook(loopState, userInstruction, modifyStopMode, { profile });
      if (blockingError && stopHookRetries < MAX_STOP_HOOK_RETRIES) {
        stopHookRetries++;
        lastTransition = "stop_hook_retry";
        messages.push({ role: "user", content: blockingError });
        continue;
      }
      break;
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments ?? "{}");
      } catch {
        args = {};
      }

      if (
        (name === "edit_file" || name === "write_file" || name === "apply_workspace_edits") &&
        args.path
      ) {
        await tracker.capture(args.path as string);
      }

      if (name === "run_scoped_tsc" && loopOptions.pendingImages?.length) {
        await awaitPendingImages(loopOptions.pendingImages);
      }

      const overrideExec = toolOverrides[name];
      const result = overrideExec ? await overrideExec(args) : await profiledExecute(name, args);

      if (name === "generate_image") {
        if (typeof result === "object" && result && "success" in result && result.success) {
          loopState.hasEdited = true;
        }
      }

      if (name === "edit_file" || name === "write_file") {
        const ok = typeof result === "object" ? result.success : true;
        if (ok) {
          loopState.hasEdited = true;
          const filePath = args.path as string;
          if (filePath) {
            const norm = filePath.replace(/\\/g, "/");
            loopState.fileEditCounts.set(norm, (loopState.fileEditCounts.get(norm) ?? 0) + 1);
            loopState.openTypeErrors += countTypeErrorsFromToolResult(result);
          }
        }
      }

      if (
        name === "search_code" ||
        name === "list_dir" ||
        name === "read_file" ||
        name === "exec_shell" ||
        name === SPAWN_SUBAGENT_TOOL_NAME
      ) {
        loopState.hasSearched = true;
        if (name === "read_file" && args.path) {
          const filePath = args.path as string;
          loopState.fileReadCounts.set(filePath, (loopState.fileReadCounts.get(filePath) ?? 0) + 1);
        }
      }

      if (name === "run_scoped_tsc") {
        loopState.hasScopedTsc = true;
        loopState.scopedTscPassed = typeof result === "object" ? result.success : !String(result).includes("failed");
      }

      const out =
        typeof result === "string" ? result : result.success ? result.output ?? "ok" : result.error ?? "failed";
      const subagentKind =
        typeof result === "object" &&
        result &&
        "meta" in result &&
        result.meta &&
        typeof result.meta === "object" &&
        "subagentKind" in result.meta
          ? String((result.meta as { subagentKind?: unknown }).subagentKind ?? "")
          : undefined;
      onEvent({
        type: "tool_call",
        tool: name,
        args,
        result: out.slice(0, 500),
        ...(subagentKind ? { subagentKind } : {}),
      });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }

    loopState.touchedFiles = [...touchedFiles];
    lastTransition = "tool_execution";
    stopHookRetries = 0;
  }

  loopState.touchedFiles = [...touchedFiles];
  return { messages, loopState, iterations };
}
