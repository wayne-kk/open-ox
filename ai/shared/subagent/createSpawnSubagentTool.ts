import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools/types";
import { getSubagentSpec } from "./registry";
import { runSubagent } from "./runSubagent";
import {
  isSubagentKind,
  SPAWN_SUBAGENT_TOOL_NAME,
  type SubagentHostContext,
  type SubagentKind,
} from "./types";

function formatToolResultPreview(result: ToolResult | string): string {
  if (typeof result === "string") return result.slice(0, 240);
  if (result.success) return (result.output ?? "ok").slice(0, 240);
  return (result.error ?? "failed").slice(0, 240);
}

export function createSpawnSubagentTool(host: SubagentHostContext): {
  tool: ChatCompletionTool;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  const allowed = host.allowedKinds;
  const kindList = allowed.join("|");
  const descriptions = allowed
    .map((k) => `- ${k}: ${getSubagentSpec(k).description}`)
    .join("\n");

  const tool: ChatCompletionTool = {
    type: "function",
    function: {
      name: SPAWN_SUBAGENT_TOOL_NAME,
      description:
        "Delegate a side task to an isolated subagent. The child runs in its own context and returns only a summary — use for broad exploration that would otherwise flood this conversation. " +
        `Allowed kinds: ${kindList}.\n${descriptions}`,
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            description: `Subagent kind (${kindList})`,
            enum: allowed,
          },
          task: {
            type: "string",
            description:
              "Self-contained task for the subagent. Include all context it needs; it cannot see prior messages.",
          },
          focusPaths: {
            type: "array",
            description: "Optional repo-relative paths to prioritize.",
            items: { type: "string" },
          },
        },
        required: ["kind", "task"],
      },
    },
  };

  const execute = async (args: Record<string, unknown>): Promise<ToolResult> => {
    const kindRaw = typeof args.kind === "string" ? args.kind.trim() : "";
    const task = typeof args.task === "string" ? args.task : "";
    const focusPaths = Array.isArray(args.focusPaths)
      ? args.focusPaths.filter((p): p is string => typeof p === "string")
      : undefined;

    if (!isSubagentKind(kindRaw)) {
      return {
        success: false,
        error: `Invalid subagent kind "${kindRaw}". Allowed: ${kindList}`,
      };
    }
    if (!allowed.includes(kindRaw)) {
      return {
        success: false,
        error: `Subagent kind "${kindRaw}" is not allowed by this host. Allowed: ${kindList}`,
      };
    }
    if (!task.trim()) {
      return { success: false, error: "spawn_subagent requires a non-empty task." };
    }

    host.onEvent?.({
      type: "thinking",
      content: `[subagent:${kindRaw}] starting — ${task.trim().slice(0, 200)}`,
      subagentKind: kindRaw,
    });

    const result = await runSubagent({
      kind: kindRaw as SubagentKind,
      task,
      focusPaths,
      model: host.model,
      onToolCall: (info) => {
        host.onEvent?.({
          type: "tool_call",
          tool: info.name,
          args: info.args,
          result: formatToolResultPreview(info.result),
          subagentKind: kindRaw,
        });
      },
    });

    if (!result.ok) {
      host.onEvent?.({
        type: "thinking",
        content: `[subagent:${kindRaw}] failed — ${result.error ?? "unknown error"}`,
        subagentKind: kindRaw,
      });
      return {
        success: false,
        error: result.error ?? "Subagent failed",
        meta: { subagentKind: kindRaw, toolCallCount: result.toolCallCount },
      };
    }

    host.onEvent?.({
      type: "thinking",
      content: `[subagent:${kindRaw}] done (${result.toolCallCount} tool calls${result.truncated ? ", truncated" : ""})`,
      subagentKind: kindRaw,
    });

    return {
      success: true,
      output: result.summary,
      meta: {
        subagentKind: kindRaw,
        toolCallCount: result.toolCallCount,
        truncated: result.truncated,
      },
    };
  };

  return { tool, execute };
}
