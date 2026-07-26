import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
}));

vi.mock("./gateway", () => ({ chatCompletion: gateway.chatCompletion }));

import { callLLMWithToolsFromMessages } from "./toolLoop";
import type {
  ChatCompletionParams,
  ChatCompletionResponse,
  ChatMessage,
} from "./types";
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
    gateway.chatCompletion.mockImplementation(
      async (params: ChatCompletionParams) =>
        (params.max_tokens ?? 0) >= 65_536
          ? response({ finishReason: "stop", content: "done" })
          : response({ finishReason: "length", content: null }),
    );

    await expect(
      callLLMWithToolsFromMessages({
        messages: initialMessages(),
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      }),
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
    gateway.chatCompletion.mockResolvedValue(
      response({ finishReason: "stop", content: "done" }),
    );

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
    expect(
      gateway.chatCompletion.mock.calls[1]?.[0].max_tokens,
    ).toBeGreaterThan(7_000);
    expect(gateway.chatCompletion.mock.calls[1]?.[0].max_tokens).toBeLessThan(
      9_000,
    );
  });

  it("does not collapse the output budget by counting ASCII code characters as tokens", async () => {
    setCustomModels([
      {
        id: "gemini-budget-probe",
        displayName: "Gemini Budget Probe",
        contextWindow: 128_000,
      },
    ]);
    gateway.chatCompletion.mockImplementation(
      async (params: ChatCompletionParams) =>
        (params.max_tokens ?? 0) >= 16_384
          ? response({ finishReason: "stop", content: "done" })
          : response({ finishReason: "length", content: null }),
    );

    await expect(
      callLLMWithToolsFromMessages({
        messages: [
          { role: "system", content: "Implement the page." },
          { role: "user", content: "x".repeat(123_000) },
        ],
        tools: [],
        model: "gemini-budget-probe",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).resolves.toEqual({ content: "done", toolCalls: [] });
    expect(gateway.chatCompletion.mock.calls[0]?.[0].max_tokens).toBe(65_536);
  });

  it("refuses to send a request when the real completion budget is unusably small", async () => {
    setCustomModels([
      {
        id: "exhausted-budget-probe",
        displayName: "Exhausted Budget Probe",
        contextWindow: 12_000,
      },
    ]);

    await expect(
      callLLMWithToolsFromMessages({
        messages: [
          { role: "system", content: "继续实现页面。" },
          { role: "user", content: "汉".repeat(11_000) },
        ],
        tools: [],
        model: "exhausted-budget-probe",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).rejects.toThrow(/insufficient completion budget/i);
    expect(gateway.chatCompletion).not.toHaveBeenCalled();
  });

  it("estimates vision input without counting base64 image bytes as text tokens", async () => {
    setCustomModels([
      {
        id: "vision-probe-model",
        displayName: "Vision Probe Model",
        contextWindow: 12_000,
      },
    ]);
    gateway.chatCompletion.mockResolvedValue(
      response({ finishReason: "stop", content: "done" }),
    );

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

    expect(
      gateway.chatCompletion.mock.calls[0]?.[0].max_tokens,
    ).toBeGreaterThan(4_000);
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
                {
                  id: "write-one",
                  function: { name: "write_file", arguments: "{}" },
                },
                {
                  id: "write-two",
                  function: { name: "write_file", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(
        response({ finishReason: "stop", content: "done" }),
      );

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

    expect(
      gateway.chatCompletion.mock.calls[0]?.[0].parallel_tool_calls,
    ).toBeUndefined();
    expect(
      gateway.chatCompletion.mock.calls[0]?.[0].messages.at(-1)?.content,
    ).toBe("Create a complete implementation.");
    expect(writeExecutions).toBe(1);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[1]?.result).toMatchObject({ success: false });
  });

  it("serializes Chrome stateful calls even when a provider returns them in one response", async () => {
    const executionOrder: string[] = [];
    gateway.chatCompletion
      .mockResolvedValueOnce({
        ...response({ finishReason: "tool_calls", content: null }),
        choices: [{
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "read", function: { name: "read_chrome_file", arguments: "{}" } },
              { id: "replace", function: { name: "replace_chrome_file", arguments: "{}" } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce(response({ finishReason: "stop", content: "done" }));

    await callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [
        { ...probeTool(), function: { ...probeTool().function, name: "read_chrome_file" } },
        { ...probeTool(), function: { ...probeTool().function, name: "replace_chrome_file" } },
      ],
      model: "probe-model",
      maxIterations: 2,
      completionProfile: "code",
      parallelToolCalls: false,
      executeToolOverrides: {
        read_chrome_file: async () => {
          executionOrder.push("read:start");
          await new Promise((resolve) => setTimeout(resolve, 0));
          executionOrder.push("read:end");
          return "read";
        },
        replace_chrome_file: async () => {
          executionOrder.push("replace");
          return "replaced";
        },
      },
    });

    expect(executionOrder).toEqual(["read:start", "read:end", "replace"]);
  });

  it("allows a caller to recover an empty assistant stop and require another round", async () => {
    gateway.chatCompletion
      .mockResolvedValueOnce(response({ finishReason: "stop", content: null }))
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
                {
                  id: "forced-write",
                  function: { name: "probe", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(
        response({ finishReason: "stop", content: "done" }),
      );

    const result = await callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [probeTool()],
      model: "probe-model",
      maxIterations: 3,
      onAssistantStop: ({ message, messages }) => {
        if (message.content) return false;
        messages.push({
          role: "user",
          content: "Call the required write tool now.",
        });
        return true;
      },
      executeToolOverrides: { probe: async () => "written" },
    });

    expect(gateway.chatCompletion).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      content: "done",
      toolCalls: [{ name: "probe", args: {}, result: "written" }],
    });
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
            message.content.includes("one small tool call"),
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
      }),
    ).resolves.toEqual({ content: "recovered", toolCalls: [] });
    expect(toolExecutions).toBe(0);
  });

  it("executes one valid tool call returned by the constrained recovery", async () => {
    let toolExecutions = 0;
    gateway.chatCompletion
      .mockResolvedValueOnce(
        response({ finishReason: "length", content: null }),
      )
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
                {
                  id: "recovered-call",
                  function: { name: "probe", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(
        response({ finishReason: "stop", content: "complete" }),
      );

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
      }),
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
      }),
    ).rejects.toThrow(
      /phase=page_implement\.test.*model=probe-model.*iteration=0.*max_tokens=65536.*prompt_tokens=12000.*completion_tokens=16384.*reasoning_tokens=7000/,
    );
    expect(gateway.chatCompletion).toHaveBeenCalledTimes(3);
  });

  it("compacts oversized tool history before retrying", async () => {
    const fullToolResult = "x".repeat(30_000);
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
      .mockResolvedValueOnce(
        response({ finishReason: "length", content: null }),
      )
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        const toolMessage = params.messages.find(
          (message) => message.role === "tool",
        );
        const compacted =
          typeof toolMessage?.content === "string" &&
          toolMessage.content.length <= 24_100;
        return compacted
          ? response({
              finishReason: "stop",
              content: "recovered after compaction",
            })
          : response({ finishReason: "length", content: null });
      });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).resolves.toEqual({
      content: "recovered after compaction",
      toolCalls: [],
    });
    expect(messages[3]?.content).toBe(fullToolResult);
  });

  it("summarizes successful oversized tool calls without emitting schema-invalid history", async () => {
    const fullToolArguments = JSON.stringify({
      path: "app/page.tsx",
      content: "x".repeat(30_000),
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
              name: "create_file",
              arguments: fullToolArguments,
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "large-write",
        content: JSON.stringify({ success: true, output: "written" }),
      },
    ];
    gateway.chatCompletion
      .mockResolvedValueOnce(
        response({ finishReason: "length", content: null }),
      )
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        const retainedAssistant = params.messages.find(
          (message) =>
            message.role === "assistant" &&
            Array.isArray(message.tool_calls) &&
            message.tool_calls.some(
              (call) =>
                typeof call === "object" &&
                call !== null &&
                (call as { id?: string }).id === "large-write",
            ),
        );
        const retainedToolResult = params.messages.find(
          (message) =>
            message.role === "tool" && message.tool_call_id === "large-write",
        );
        const summary = params.messages.find(
          (message) =>
            message.role === "system" &&
            typeof message.content === "string" &&
            message.content.includes("create_file app/page.tsx") &&
            message.content.includes("succeeded"),
        );
        const protocolSafe =
          !retainedAssistant &&
          !retainedToolResult &&
          Boolean(summary) &&
          !JSON.stringify(params.messages).includes("_compacted");
        return protocolSafe
          ? response({
              finishReason: "stop",
              content: "recovered after protocol-safe compaction",
            })
          : response({ finishReason: "length", content: null });
      });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).resolves.toEqual({
      content: "recovered after protocol-safe compaction",
      toolCalls: [],
    });
    const retainedToolCall = messages[2]?.tool_calls?.[0] as
      | { function?: { arguments?: string } }
      | undefined;
    expect(retainedToolCall?.function?.arguments).toBe(fullToolArguments);
  });

  it("preserves oversized failed tool calls for model recovery", async () => {
    const fullToolArguments = JSON.stringify({
      path: "components/pages/home/SpotlightPlayers.tsx",
      content: "x".repeat(13_000),
    });
    const messages: ChatMessage[] = [
      ...initialMessages(),
      {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "failed-write",
          function: { name: "create_file", arguments: fullToolArguments },
        }],
      },
      {
        role: "tool",
        tool_call_id: "failed-write",
        content: JSON.stringify({
          success: false,
          error: "INVALID_ARGUMENT: create_file.content must be a string",
        }),
      },
    ];
    gateway.chatCompletion.mockImplementationOnce(async (params: ChatCompletionParams) => {
      const assistant = params.messages.find(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (call) =>
              typeof call === "object" &&
              call !== null &&
              (call as { id?: string }).id === "failed-write",
          ),
      );
      const call = assistant?.tool_calls?.[0] as
        | { function?: { arguments?: string } }
        | undefined;
      const preserved = call?.function?.arguments === fullToolArguments;
      return response({
        finishReason: "stop",
        content: preserved ? "failure context preserved" : "failure context corrupted",
      });
    });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).resolves.toMatchObject({ content: "failure context preserved" });
  });

  it("preserves successful oversized tool calls that still have diagnostics", async () => {
    const fullToolArguments = JSON.stringify({
      path: "app/page.tsx",
      content: "x".repeat(13_000),
    });
    const messages: ChatMessage[] = [
      ...initialMessages(),
      {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "write-with-diagnostics",
          function: { name: "create_file", arguments: fullToolArguments },
        }],
      },
      {
        role: "tool",
        tool_call_id: "write-with-diagnostics",
        content: JSON.stringify({
          success: true,
          output: JSON.stringify({
            success: true,
            diagnostics: [{ code: "TS2613", message: "No default export" }],
          }),
        }),
      },
    ];
    gateway.chatCompletion.mockImplementationOnce(async (params: ChatCompletionParams) => {
      const preserved = params.messages.some(
        (message) =>
          message.role === "tool" &&
          message.tool_call_id === "write-with-diagnostics" &&
          typeof message.content === "string" &&
          message.content.includes("TS2613"),
      );
      return response({
        finishReason: "stop",
        content: preserved ? "diagnostics preserved" : "diagnostics lost",
      });
    });

    await expect(
      callLLMWithToolsFromMessages({
        messages,
        tools: [],
        model: "probe-model",
        maxIterations: 1,
        completionProfile: "code",
      }),
    ).resolves.toMatchObject({ content: "diagnostics preserved" });
  });

  it("rejects history whose last conversational turn is assistant", async () => {
    gateway.chatCompletion.mockResolvedValue(
      response({ finishReason: "stop", content: "should not run" }),
    );

    await expect(
      callLLMWithToolsFromMessages({
        messages: [
          ...initialMessages(),
          { role: "assistant", content: "I stopped before finishing." },
          { role: "system", content: "Continue working." },
        ],
        tools: [probeTool()],
        model: "gemini-probe-model",
        maxIterations: 1,
        requireTools: true,
      }),
    ).rejects.toThrow(/ends with an assistant\/model turn/i);
    expect(gateway.chatCompletion).not.toHaveBeenCalled();
  });

  it("reports Gemini model-turn errors as invalid history, not missing tool support", async () => {
    gateway.chatCompletion.mockRejectedValue(
      new Error(
        'LLM HTTP 400: {"error":{"message":"Provider API error: Requests ending with a model turn are not supported."}}',
      ),
    );

    const result = callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [probeTool()],
      model: "gemini-probe-model",
      maxIterations: 1,
      requireTools: true,
    });

    await expect(result).rejects.toThrow(/invalid conversation history/i);
    await expect(result).rejects.not.toThrow(/verify the model is compatible/i);
  });

  it("does not misclassify a generic provider INVALID_ARGUMENT as missing tool support", async () => {
    gateway.chatCompletion.mockRejectedValue(
      new Error(
        'LLM HTTP 400: {"error":{"code":400,"message":"Provider API error: Request contains an invalid argument.","param":"INVALID_ARGUMENT"}}',
      ),
    );

    const result = callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [probeTool()],
      model: "gemini-probe-model",
      maxIterations: 1,
      requireTools: true,
    });

    await expect(result).rejects.toThrow(/Request contains an invalid argument/i);
    await expect(result).rejects.not.toThrow(/verify the model is compatible/i);
    expect(gateway.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("retries generic INVALID_ARGUMENT once without optional provider parameters", async () => {
    gateway.chatCompletion
      .mockRejectedValueOnce(new Error("LLM HTTP 400: INVALID_ARGUMENT: Request contains an invalid argument"))
      .mockImplementationOnce(async (params: ChatCompletionParams) => {
        expect(params.tools).toHaveLength(1);
        expect(params.tool_choice).toBeUndefined();
        expect(params.parallel_tool_calls).toBeUndefined();
        expect(params.thinking_level).toBeUndefined();
        return response({ finishReason: "stop", content: "recovered" });
      });

    await expect(callLLMWithToolsFromMessages({
      messages: initialMessages(), tools: [probeTool()], model: "openai-probe-model",
      maxIterations: 1, requireTools: true, thinkingLevel: "high", parallelToolCalls: false,
    })).resolves.toEqual({ content: "recovered", toolCalls: [] });
    expect(gateway.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("reports compatibility only when the provider explicitly rejects tools", async () => {
    gateway.chatCompletion.mockRejectedValue(
      new Error("LLM HTTP 400: function calling is not supported by this model"),
    );
    await expect(callLLMWithToolsFromMessages({
      messages: initialMessages(), tools: [probeTool()], model: "plain-model",
      maxIterations: 1, requireTools: true,
    })).rejects.toThrow(/verify the model is compatible/i);
    expect(gateway.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("does not misclassify an exhausted upstream-wrapped 400 as missing tool support", async () => {
    gateway.chatCompletion.mockRejectedValue(
      new Error(
        'LLM HTTP 400 after 5 attempt(s): {"error":{"code":"bad_response_status_code","type":"upstream_error"}}',
      ),
    );
    const result = callLLMWithToolsFromMessages({
      messages: initialMessages(),
      tools: [probeTool()],
      model: "gemini-probe-model",
      maxIterations: 1,
      requireTools: true,
    });
    await expect(result).rejects.toThrow(/transient provider upstream failure/i);
    await expect(result).rejects.not.toThrow(/verify the model is compatible/i);
  });
});
