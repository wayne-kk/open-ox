import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { executeSystemTool } from "@/ai/tools";
import type { ToolExecutor } from "@/ai/tools/types";
import { chatCompletion, type ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import { lfModifyAgentRound } from "@/lib/observability/langfuseGenerationCatalog";
import { getModifyModelId } from "@/lib/config/models";
import type { FileSnapshotTracker } from "../tracking/fileSnapshotTracker";
import { runStopHook, type LoopState, type ModifyStopMode } from "./stopHooks";
import { compressContext } from "./contextCompression";
import { awaitPendingImages, type PendingImage } from "@/ai/tools/system/generateImageTool";

/** Core tools for modify (no image generation). */
export const MODIFY_AGENT_TOOLS_CORE = [
  "read_file",
  "search_code",
  "list_dir",
  "edit_file",
  "write_file",
  "run_build",
  "exec_shell",
  "think",
  "revert_file",
] as const;

/** Full tool list when code edits / assets are allowed (includes generate_image). */
export const MODIFY_AGENT_TOOLS_WITH_IMAGE = [...MODIFY_AGENT_TOOLS_CORE, "generate_image"] as const;

const MAX_ITERATIONS = 100;
const MAX_STOP_HOOK_RETRIES = 5;

type OnEvent = (event: {
  type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error";
  [key: string]: unknown;
}) => void;

export type RunAgentLoopOptions = {
  toolOverrides?: Record<string, ToolExecutor>;
  pendingImages?: PendingImage[];
  /** Tool names passed to the model (defaults to WITH_IMAGE when overrides include generate_image logic — caller sets explicitly). */
  toolNames?: string[];
};

export async function runAgentLoop(
  messages: ChatMessage[],
  tracker: FileSnapshotTracker,
  onEvent: OnEvent,
  userInstruction: string,
  modelOverride?: string,
  modifyStopMode: ModifyStopMode = "code_change",
  loopOptions?: RunAgentLoopOptions
): Promise<{ messages: ChatMessage[]; loopState: LoopState; iterations: number }> {
  const toolNameList = loopOptions?.toolNames ?? [...MODIFY_AGENT_TOOLS_WITH_IMAGE];
  const model = modelOverride || getModifyModelId();
  const tools = getSystemToolDefinitions(toolNameList);
  const loopState: LoopState = {
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
  };
  let iterations = 0;
  let stopHookRetries = 0;
  let lastTransition: "initial" | "stop_hook_retry" | "tool_execution" = "initial";

  while (iterations < MAX_ITERATIONS) {
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
          },
        });
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRetryable = /400|429|500|502|503|504|ETIMEDOUT|ECONNRESET|Thought signature/i.test(errMsg);
        if (isRetryable && attempt < MAX_LLM_RETRIES) {
          const delayMs = 1000 * (attempt + 1);
          onEvent({ type: "thinking", content: `[LLM Retry] Attempt ${attempt + 1} failed: ${errMsg.slice(0, 200)}. Retrying...` });
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
      const blockingError = runStopHook(loopState, userInstruction, modifyStopMode);
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

      if ((name === "edit_file" || name === "write_file") && args.path) {
        await tracker.capture(args.path as string);
      }

      if (name === "run_build" && loopOptions?.pendingImages?.length) {
        await awaitPendingImages(loopOptions.pendingImages);
      }

      const overrideExec = loopOptions?.toolOverrides?.[name];
      const result = overrideExec ? await overrideExec(args) : await executeSystemTool(name, args);

      if (name === "generate_image") {
        if (typeof result === "object" && result && "success" in result && result.success) {
          loopState.hasEdited = true;
        }
      }

      if (name === "edit_file" || name === "write_file") {
        if (typeof result === "object" ? result.success : true) loopState.hasEdited = true;
        const filePath = args.path as string;
        if (filePath) loopState.fileEditCounts.set(filePath, (loopState.fileEditCounts.get(filePath) ?? 0) + 1);
      }
      if (name === "search_code" || name === "list_dir" || name === "read_file" || name === "exec_shell") {
        loopState.hasSearched = true;
        if (name === "read_file" && args.path) {
          const filePath = args.path as string;
          loopState.fileReadCounts.set(filePath, (loopState.fileReadCounts.get(filePath) ?? 0) + 1);
        }
      }
      if (name === "run_build") {
        loopState.hasBuild = true;
        loopState.buildPassed = typeof result === "object" ? result.success : !String(result).includes("failed");
        loopState.lastBuildOutput = typeof result === "object" ? (result.output ?? result.error ?? "") : String(result);
      }

      const out = typeof result === "string" ? result : result.success ? result.output ?? "ok" : result.error ?? "failed";
      onEvent({ type: "tool_call", tool: name, args, result: out.slice(0, 500) });
      messages.push({ role: "tool", tool_call_id: tc.id, content: typeof result === "string" ? result : JSON.stringify(result) });
    }

    lastTransition = "tool_execution";
    stopHookRetries = 0;
  }

  return { messages, loopState, iterations };
}
