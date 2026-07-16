import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertCanSpawnSubagent,
  createSpawnSubagentTool,
  getSubagentSpec,
  listSubagentKinds,
  MAX_SUBAGENT_DEPTH,
  registerSubagent,
  resetSubagentRegistryForTests,
  runSubagent,
  SPAWN_SUBAGENT_TOOL_NAME,
  withSubagentDepth,
} from "./index";

vi.mock("@/ai/shared/llm/toolLoop", () => ({
  callLLMWithTools: vi.fn(),
}));

import { callLLMWithTools } from "@/ai/shared/llm/toolLoop";

const mockedCallLLM = vi.mocked(callLLMWithTools);

afterEach(() => {
  resetSubagentRegistryForTests();
  vi.clearAllMocks();
});

describe("subagent registry", () => {
  it("registers builtin explore, verifier, and research", () => {
    expect(listSubagentKinds().sort()).toEqual(["explore", "research", "verifier"]);
    expect(getSubagentSpec("explore").readonly).toBe(true);
    expect(getSubagentSpec("verifier").toolNames).toContain("run_scoped_tsc");
    expect(getSubagentSpec("research").toolNames).toContain("reference_site_digest");
  });

  it("allows replacing a kind via registerSubagent", () => {
    registerSubagent({
      ...getSubagentSpec("explore"),
      description: "custom explore",
      maxIterations: 3,
    });
    expect(getSubagentSpec("explore").description).toBe("custom explore");
    expect(getSubagentSpec("explore").maxIterations).toBe(3);
  });
});

describe("subagent nesting", () => {
  it("allows spawn at depth 0", () => {
    expect(() => assertCanSpawnSubagent()).not.toThrow();
  });

  it("rejects spawn at max depth", async () => {
    await withSubagentDepth(async () => {
      expect(MAX_SUBAGENT_DEPTH).toBe(1);
      expect(() => assertCanSpawnSubagent()).toThrow(/nesting limit/i);
    });
  });

  it("runSubagent refuses nested spawn", async () => {
    await withSubagentDepth(async () => {
      const result = await runSubagent({
        kind: "explore",
        task: "find auth helpers",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/nesting limit/i);
    });
    expect(mockedCallLLM).not.toHaveBeenCalled();
  });
});

describe("createSpawnSubagentTool", () => {
  it("rejects empty task and disallowed kind", async () => {
    const { execute } = createSpawnSubagentTool({ allowedKinds: ["explore"] });
    await expect(execute({ kind: "explore", task: "  " })).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/non-empty task/i),
    });
    await expect(
      execute({ kind: "verifier", task: "check build" })
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/not allowed/i),
    });
  });

  it("returns only the child summary to the parent", async () => {
    mockedCallLLM.mockResolvedValue({
      content: "FINDINGS:\n- auth is in lib/auth.ts",
      toolCalls: [
        {
          name: "search_code",
          args: { query: "auth" },
          result: { success: true, output: "huge noisy dump ".repeat(50) },
        },
      ],
    });

    const events: Array<{ type: string; subagentKind?: string }> = [];
    const { tool, execute } = createSpawnSubagentTool({
      allowedKinds: ["explore"],
      onEvent: (e) => events.push(e),
    });

    expect(tool.function.name).toBe(SPAWN_SUBAGENT_TOOL_NAME);

    const result = await execute({
      kind: "explore",
      task: "Where is auth?",
      focusPaths: ["lib/"],
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("FINDINGS:\n- auth is in lib/auth.ts");
    expect(result.output).not.toContain("huge noisy dump");
    expect(mockedCallLLM).toHaveBeenCalledOnce();
    const callArgs = mockedCallLLM.mock.calls[0]?.[0];
    expect(callArgs?.langfusePhase).toBe("subagent_explore");
    expect(callArgs?.tools.map((t) => t.function.name).sort()).toEqual(
      ["list_dir", "read_file", "search_code", "think"].sort()
    );
    expect(events.some((e) => e.type === "thinking" && e.subagentKind === "explore")).toBe(
      true
    );
  });
});

describe("runSubagent", () => {
  it("rejects empty task without calling the LLM", async () => {
    const result = await runSubagent({ kind: "explore", task: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-empty/i);
    expect(mockedCallLLM).not.toHaveBeenCalled();
  });

  it("truncates long summaries", async () => {
    registerSubagent({
      ...getSubagentSpec("explore"),
      maxSummaryChars: 40,
    });
    mockedCallLLM.mockResolvedValue({
      content: "x".repeat(100),
      toolCalls: [],
    });
    const result = await runSubagent({ kind: "explore", task: "scan" });
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(40);
    expect(result.summary).toContain("[truncated]");
  });
});
