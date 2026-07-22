import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
}));

vi.mock("./gateway", () => ({ chatCompletion: gateway.chatCompletion }));

import { callLLMWithToolsFromMessages } from "./toolLoop";
import type { ChatCompletionParams, ChatCompletionResponse, ChatMessage } from "./types";
import { setCustomModels } from "@/lib/config/models";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

function response(input: {
  finishReason: string;
  content: string | null;
}): ChatCompletionResponse {
  return {
    id: "probe-response",
    model: "probe-model",
    choices: [
      {
        index: 0,
        finish_reason: input.finishReason,
        message: { role: "assistant", content: input.content },
      },
    ],
  };
}

function initialMessages(): ChatMessage[] {
  return [
    { role: "system", content: "Build the requested page." },
    { role: "user", content: "Create a complete implementation." },
  ];
}

function probeTool(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "probe",
      description: "Record whether a tool call was executed.",
      parameters: { type: "object", properties: {} },
    },
  };
}

describe("callLLMWithToolsFromMessages", () => {
  beforeEach(() => {
    gateway.chatCompletion.mockReset();
    setCustomModels([]);
  });

  it("gives code-writing rounds a sufficient completion budget", async () => {
    gateway.chatCompletion.mockImplementation(async (params: ChatCompletionParams) =>
      (params.max_tokens ?? 0) >= 16_384
        ? response({ finishReason: "stop", content: "done" })
        : response({ finishReason: "length", content: null })
    );

    await expect(
      callLLMWithToolsFromMessages({
        messages: initialMessages(),
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      })
    ).resolves.toEqual({ content: "done", toolCalls: [] });
  });

  it("uses the control budget and caps profiles to the remaining model context", async () => {
    setCustomModels([
      {
        id: "small-probe-model",
        displayName: "Small Probe Model",
        contextWindow: 12_000,
      },
    ]);
    gateway.chatCompletion.mockResolvedValue(response({ finishReason: "stop", content: "done" }));

    await callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [],
      model: "probe-model",
      maxIterations: 1,
      completionProfile: "control",
    });
    await callLLMWithToolsFromMessages({
      messages: [
        { role: "system", content: "Build the requested page." },
        { role: "user", content: "x".repeat(9_000) },
      ],
      tools: [],
      model: "small-probe-model",
      maxIterations: 1,
      completionProfile: "code",
    });

    expect(gateway.chatCompletion.mock.calls[0]?.[0].max_tokens).toBe(8_192);
    expect(gateway.chatCompletion.mock.calls[1]?.[0].max_tokens).toBeGreaterThan(0);
    expect(gateway.chatCompletion.mock.calls[1]?.[0].max_tokens).toBeLessThan(2_000);
  });

  it("estimates vision input without counting base64 image bytes as text tokens", async () => {
    setCustomModels([
      {
        id: "vision-probe-model",
        displayName: "Vision Probe Model",
        contextWindow: 12_000,
      },
    ]);
    gateway.chatCompletion.mockResolvedValue(response({ finishReason: "stop", content: "done" }));

    await callLLMWithToolsFromMessages({
      messages: [
        { role: "system", content: "Recreate this screenshot." },
        {
          role: "user",
          content: [
            { type: "text", text: "Match the layout." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${"a".repeat(100_000)}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      tools: [],
      model: "vision-probe-model",
      maxIterations: 1,
      completionProfile: "code",
    });

    expect(gateway.chatCompletion.mock.calls[0]?.[0].max_tokens).toBeGreaterThan(4_000);
  });

  it("allows parallel reads but executes only one source mutation per code response", async () => {
    let writeExecutions = 0;
    gateway.chatCompletion
      .mockResolvedValueOnce({
        ...response({ finishReason: "tool_calls", content: null }),
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                { id: "write-one", function: { name: "write_file", arguments: "{}" } },
                { id: "write-two", function: { name: "write_file", arguments: "{}" } },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(response({ finishReason: "stop", content: "done" }));

    const result = await callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [
        probeTool(),
        {
          ...probeTool(),
          function: { ...probeTool().function, name: "write_file" },
        },
      ],
      model: "probe-model",
      maxIterations: 2,
      completionProfile: "code",
      executeToolOverrides: {
        write_file: async () => {
          writeExecutions += 1;
          return "written";
        },
      },
    });

    expect(gateway.chatCompletion.mock.calls[0]?.[0].parallel_tool_calls).toBeUndefined();
    expect(gateway.chatCompletion.mock.calls[0]?.[0].messages.at(-1)?.content).toContain(
      "Read-only tools may be called in parallel"
    );
    expect(writeExecutions).toBe(1);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[1]?.result).toMatchObject({ success: false });
  });

  it("recovers a truncated round without executing its partial tool calls", async () => {
    let toolExecutions = 0;
    gateway.chatCompletion
      .mockResolvedValueOnce({
        ...response({ finishReason: "length", content: null }),
        choices: [
          {
            index: 0,
            finish_reason: "length",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "partial-call",
                  function: { name: "probe", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        const hasRetryNudge = params.messages.some(
          (message) =>
            typeof message.content === "string" &&
            message.content.includes("one small tool call")
        );
        const retryIsConstrained =
          params.parallel_tool_calls === false &&
          params.thinking_level === "minimal" &&
          hasRetryNudge;
        return retryIsConstrained
          ? response({ finishReason: "stop", content: "recovered" })
          : response({ finishReason: "length", content: null });
      });

    await expect(
      callLLMWithToolsFromMessages({
        messages: initialMessages(),
        tools: [probeTool()],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
        thinkingLevel: "high",
        executeToolOverrides: {
          probe: async () => {
            toolExecutions += 1;
            return "executed";
          },
        },
      })
    ).resolves.toEqual({ content: "recovered", toolCalls: [] });
    expect(toolExecutions).toBe(0);
  });

  it("executes one valid tool call returned by the constrained recovery", async () => {
    let toolExecutions = 0;
    gateway.chatCompletion
      .mockResolvedValueOnce(response({ finishReason: "length", content: null }))
      .mockResolvedValueOnce({
        ...response({ finishReason: "tool_calls", content: null }),
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                { id: "recovered-call", function: { name: "probe", arguments: "{}" } },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(response({ finishReason: "stop", content: "complete" }));

    await expect(
      callLLMWithToolsFromMessages({
        messages: initialMessages(),
        tools: [probeTool()],
        model: "probe-model",
        maxIterations: 2,
        completionProfile: "code",
        executeToolOverrides: {
          probe: async () => {
            toolExecutions += 1;
            return "executed";
          },
        },
      })
    ).resolves.toEqual({
      content: "complete",
      toolCalls: [{ name: "probe", args: {}, result: "executed" }],
    });
    expect(toolExecutions).toBe(1);
  });

  it("reports actionable diagnostics after the recovery attempt is also truncated", async () => {
    const truncatedWithUsage = {
      ...response({ finishReason: "length", content: null }),
      usage: {
        prompt_tokens: 12_000,
        completion_tokens: 16_384,
        total_tokens: 28_384,
        completion_tokens_details: { reasoning_tokens: 7_000 },
      },
    } as ChatCompletionResponse;
    gateway.chatCompletion.mockResolvedValue(truncatedWithUsage);

    await expect(
      callLLMWithToolsFromMessages({
        messages: initialMessages(),
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
        langfusePhase: "page_implement.test",
      })
    ).rejects.toThrow(
      /phase=page_implement\.test.*model=probe-model.*iteration=0.*max_tokens=16384.*prompt_tokens=12000.*completion_tokens=16384.*reasoning_tokens=7000/
    );
    expect(gateway.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("compacts oversized tool history before retrying", async () => {
    const fullToolResult = "x".repeat(20_000);
    const messages: ChatMessage[] = [
      ...initialMessages(),
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "large-read", function: { name: "probe", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "large-read", content: fullToolResult },
    ];
    gateway.chatCompletion
      .mockResolvedValueOnce(response({ finishReason: "length", content: null }))
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        const toolMessage = params.messages.find((message) => message.role === "tool");
        const compacted =
          typeof toolMessage?.content === "string" && toolMessage.content.length <= 2_100;
        return compacted
          ? response({ finishReason: "stop", content: "recovered after compaction" })
          : response({ finishReason: "length", content: null });
      });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      })
    ).resolves.toEqual({ content: "recovered after compaction", toolCalls: [] });
    expect(messages[3]?.content).toBe(fullToolResult);
  });

  it("compacts oversized arguments from completed tool calls before retrying", async () => {
    const fullToolArguments = JSON.stringify({
      path: "app/page.tsx",
      content: "x".repeat(20_000),
    });
    const messages: ChatMessage[] = [
      ...initialMessages(),
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "large-write",
            function: {
              name: "probe",
              arguments: fullToolArguments,
            },
          },
        ],
      },
      { role: "tool", tool_call_id: "large-write", content: "written" },
    ];
    gateway.chatCompletion
      .mockResolvedValueOnce(response({ finishReason: "length", content: null }))
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        const assistant = params.messages.find(
          (message) => message.role === "assistant" && Array.isArray(message.tool_calls)
        );
        const toolCall = assistant?.tool_calls?.[0] as
          | { function?: { arguments?: string } }
          | undefined;
        const compacted = (toolCall?.function?.arguments?.length ?? Infinity) <= 2_100;
        return compacted
          ? response({ finishReason: "stop", content: "recovered after argument compaction" })
          : response({ finishReason: "length", content: null });
      });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      })
    ).resolves.toEqual({
      content: "recovered after argument compaction",
      toolCalls: [],
    });
    const retainedToolCall = messages[2]?.tool_calls?.[0] as
      | { function?: { arguments?: string } }
      | undefined;
    expect(retainedToolCall?.function?.arguments).toBe(fullToolArguments);
  });
});
