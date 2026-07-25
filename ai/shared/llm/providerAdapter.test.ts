import { describe, expect, it } from "vitest";
import { buildProviderPayload, validateProviderPayload } from "./providerAdapter";
import type { ChatCompletionParams } from "./types";

const base: ChatCompletionParams = {
  model: "gemini-3.6-flash",
  provider: "gemini-compatible",
  messages: [
    { role: "system", content: "Base rules" },
    { role: "user", content: "Build" },
    { role: "system", content: "Late policy" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "call-1", type: "function", function: { name: "write", arguments: { path: "a.ts" } } }],
    },
    { role: "tool", tool_call_id: "call-1", content: { success: true } as never },
  ],
  tools: [{ type: "function", function: {
    name: "write",
    parameters: { type: "object", properties: { line: { type: "number" } }, required: ["line"] },
  } }],
  tool_choice: "required",
  parallel_tool_calls: false,
  thinking_level: "high",
};

describe("buildProviderPayload", () => {
  it("projects Gemini-compatible history without late system roles or unsupported controls", () => {
    const payload = buildProviderPayload(base);
    expect(payload.messages.map((message) => message.role)).toEqual([
      "system", "user", "user", "assistant", "tool",
    ]);
    expect(payload.messages[2]?.content).toContain("Late policy");
    expect(payload.messages.at(-1)?.role).toBe("tool");
    expect(payload).not.toHaveProperty("tool_choice");
    expect(payload).not.toHaveProperty("parallel_tool_calls");
    expect(payload).not.toHaveProperty("thinking_level");
  });

  it("normalizes tool history and integer coordinates at the wire seam", () => {
    const payload = buildProviderPayload(base);
    const call = payload.messages[3]?.tool_calls?.[0] as { function: { arguments: unknown } };
    expect(typeof call.function.arguments).toBe("string");
    expect(typeof payload.messages[4]?.content).toBe("string");
    const parameters = payload.tools?.[0]?.function.parameters as { properties: { line: { type: string } } };
    expect(parameters.properties.line.type).toBe("integer");
  });

  it("preserves supported OpenAI request controls", () => {
    const payload = buildProviderPayload({ ...base, model: "gpt-probe", provider: "openai" });
    expect(payload.tool_choice).toBe("required");
    expect(payload.parallel_tool_calls).toBe(false);
    expect(payload.thinking_level).toBe("high");
  });

  it("rejects any Gemini request that ends with an assistant/model turn", () => {
    const payload = buildProviderPayload({
      ...base,
      messages: base.messages.slice(0, -1),
    });
    expect(() => validateProviderPayload(payload, "gemini-compatible"))
      .toThrow(/ends with an assistant\/model turn/i);
  });

  it("rejects orphan and missing tool results before network I/O", () => {
    const orphan = buildProviderPayload({
      ...base,
      messages: [
        { role: "system", content: "Build" },
        { role: "user", content: "Continue" },
        { role: "tool", tool_call_id: "unknown", content: "ok" },
      ],
    });
    expect(() => validateProviderPayload(orphan, "gemini-compatible"))
      .toThrow(/orphan tool result/i);

    const missing = buildProviderPayload({
      ...base,
      model: "gpt-probe",
      provider: "openai",
      messages: [
        { role: "system", content: "Build" },
        { role: "user", content: "Continue" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "pending", type: "function", function: { name: "write", arguments: "{}" } }],
        },
        { role: "user", content: "Continue anyway" },
      ],
    });
    expect(() => validateProviderPayload(missing, "openai"))
      .toThrow(/missing tool result/i);
  });
});
