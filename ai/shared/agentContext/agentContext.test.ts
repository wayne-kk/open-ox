import { describe, expect, it } from "vitest";
import { createAgentContext, InMemoryContextEventStore } from "./index";

describe("AgentContext", () => {
  it("projects a complete multi-call protocol unit without changing its order", async () => {
    const context = createAgentContext(
      { sessionId: "page:home", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );

    await context.append([
      { kind: "instruction", scope: "system", content: "Build the page." },
      { kind: "user_message", content: "Create home." },
      {
        kind: "assistant_tool_calls",
        content: null,
        calls: [
          { id: "read-1", name: "read_file_snapshot", argumentsJson: '{"path":"app/page.tsx"}' },
          { id: "search-1", name: "search_code", argumentsJson: '{"query":"Nav"}' },
        ],
      },
      {
        kind: "tool_result",
        callId: "read-1",
        toolName: "read_file_snapshot",
        arguments: { path: "app/page.tsx" },
        result: { success: true, output: "export default function Page() {}" },
      },
      {
        kind: "tool_result",
        callId: "search-1",
        toolName: "search_code",
        arguments: { query: "Nav" },
        result: { success: true, output: "components/Nav.tsx" },
      },
    ]);

    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [],
      toolChoice: "auto",
      completionProfile: "code",
      pressure: "normal",
    });

    expect(projection.maxCompletionTokens).toBe(65_536);
    expect(projection.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "tool",
    ]);
    expect(projection.messages[2]?.tool_calls).toHaveLength(2);
    expect(projection.messages[3]?.tool_call_id).toBe("read-1");
    expect(projection.messages[4]?.tool_call_id).toBe("search-1");
  });

  it("replaces a completed large mutation with a receipt while keeping canonical payload", async () => {
    const eventStore = new InMemoryContextEventStore();
    const context = createAgentContext(
      { sessionId: "page:profile", sessionKind: "page", policyVersion: "v1" },
      { eventStore },
    );
    const source = `export default function Profile() { return <main>${"x".repeat(30_000)}</main>; }`;

    await context.append([
      { kind: "instruction", scope: "system", content: "Build profile." },
      { kind: "user_message", content: "Create profile." },
      {
        kind: "assistant_tool_calls",
        content: null,
        calls: [{
          id: "create-profile",
          name: "create_file",
          argumentsJson: JSON.stringify({ path: "app/profile/page.tsx", content: source }),
        }],
      },
      {
        kind: "tool_result",
        callId: "create-profile",
        toolName: "create_file",
        arguments: { path: "app/profile/page.tsx", content: source },
        result: { success: true, output: { revision: "sha256:profile", diagnostics: [] } },
      },
      { kind: "user_message", content: "Verify the remaining work." },
    ]);

    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [],
      toolChoice: "auto",
      completionProfile: "code",
      pressure: "normal",
    });

    expect(JSON.stringify(projection.messages)).not.toContain(source);
    expect(JSON.stringify(projection.messages)).toContain("create_file app/profile/page.tsx: succeeded");
    expect(JSON.stringify(projection.messages)).toContain("sha256:profile");
    expect(projection.compaction.stages).toContain("mutation_receipts");

    const canonical = await eventStore.read("page:profile");
    expect(JSON.stringify(canonical)).toContain(source);
  });

  it("omits a superseded file snapshot as a complete protocol unit", async () => {
    const context = createAgentContext(
      { sessionId: "page:snapshots", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );
    await context.append([
      { kind: "instruction", scope: "system", content: "Build." },
      { kind: "user_message", content: "Inspect the file." },
      {
        kind: "assistant_tool_calls",
        content: null,
        calls: [{ id: "read-old", name: "read_file_snapshot", argumentsJson: '{"path":"app/page.tsx"}' }],
      },
      {
        kind: "tool_result",
        callId: "read-old",
        toolName: "read_file_snapshot",
        arguments: { path: "app/page.tsx" },
        result: { success: true, output: { content: "OLD_SOURCE", revision: "rev-old" } },
      },
      {
        kind: "assistant_tool_calls",
        content: null,
        calls: [{ id: "read-new", name: "read_file_snapshot", argumentsJson: '{"path":"app/page.tsx"}' }],
      },
      {
        kind: "tool_result",
        callId: "read-new",
        toolName: "read_file_snapshot",
        arguments: { path: "app/page.tsx" },
        result: { success: true, output: { content: "NEW_SOURCE", revision: "rev-new" } },
      },
    ]);

    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [],
      toolChoice: "auto",
      completionProfile: "code",
      pressure: "normal",
    });

    expect(JSON.stringify(projection.messages)).not.toContain("OLD_SOURCE");
    expect(JSON.stringify(projection.messages)).toContain("NEW_SOURCE");
    expect(projection.messages.some((message) => message.tool_call_id === "read-old")).toBe(false);
    expect(projection.compaction.stages).toContain("superseded_observations");
  });

  it("keeps an incomplete multi-call unit canonical but omits the entire unit from projection", async () => {
    const eventStore = new InMemoryContextEventStore();
    const context = createAgentContext(
      { sessionId: "page:crash", sessionKind: "page", policyVersion: "v1" },
      { eventStore },
    );
    await context.append([
      { kind: "instruction", scope: "system", content: "Build." },
      { kind: "user_message", content: "Inspect both." },
      {
        kind: "assistant_tool_calls",
        content: null,
        calls: [
          { id: "a", name: "read_file", argumentsJson: '{"path":"a.ts"}' },
          { id: "b", name: "read_file", argumentsJson: '{"path":"b.ts"}' },
        ],
      },
      { kind: "tool_result", callId: "a", toolName: "read_file", arguments: { path: "a.ts" }, result: { success: true, output: "a" } },
    ]);
    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [], toolChoice: "auto", completionProfile: "code", pressure: "normal",
    });
    expect(projection.messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(await eventStore.read("page:crash")).toHaveLength(4);
  });

  it("resolves a condensation record without splitting a tool protocol unit", async () => {
    const store = new InMemoryContextEventStore();
    const context = createAgentContext(
      { sessionId: "intent:condensed", sessionKind: "intent", policyVersion: "v1" },
      { eventStore: store },
    );
    const receipt = await context.append([
      { kind: "instruction", scope: "system", content: "Help." },
      { kind: "user_message", content: "Old question" },
      { kind: "assistant_message", content: "Old answer" },
      { kind: "user_message", content: "Current question" },
    ]);
    await context.append([{ kind: "condensation", condensation: {
      coveredSequence: { from: 2, through: 3 },
      forgottenEventIds: [receipt.eventIds[1]!, receipt.eventIds[2]!],
      summary: "The earlier question was resolved.",
      policyVersion: "v1",
    } }]);
    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [], toolChoice: "auto", completionProfile: "control", pressure: "normal",
    });
    expect(JSON.stringify(projection.messages)).not.toContain("Old question");
    expect(JSON.stringify(projection.messages)).toContain("earlier question was resolved");
    expect(projection.compaction.stages).toContain("semantic_condensation");
  });

  it("fails instead of silently shrinking the completion profile reserve", async () => {
    const context = createAgentContext(
      { sessionId: "page:budget", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );
    await context.append([
      { kind: "instruction", scope: "system", content: "Build." },
      { kind: "user_message", content: "x".repeat(9_000) },
    ]);
    await expect(context.project({
      model: { id: "small", provider: "openai", contextWindow: 12_000 },
      tools: [], toolChoice: "auto", completionProfile: "code", pressure: "normal",
    })).rejects.toThrow(/CONTEXT_EXHAUSTED.*completion_reserve=65536/);
  });

  it("rejects duplicate tool results before they enter the canonical log", async () => {
    const context = createAgentContext(
      { sessionId: "page:duplicate", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );
    await context.append([{
      kind: "assistant_tool_calls", content: null,
      calls: [{ id: "read", name: "read_file", argumentsJson: '{"path":"a.ts"}' }],
    }, {
      kind: "tool_result", callId: "read", toolName: "read_file",
      arguments: { path: "a.ts" }, result: { success: true, output: "a" },
    }]);
    await expect(context.append([{
      kind: "tool_result", callId: "read", toolName: "read_file",
      arguments: { path: "a.ts" }, result: { success: true, output: "again" },
    }])).rejects.toThrow(/duplicate tool result/);
  });

  it("rejects condensation references outside their declared closed span", async () => {
    const context = createAgentContext(
      { sessionId: "page:bad-condensation", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );
    const receipt = await context.append([{ kind: "user_message", content: "Keep me" }]);
    await expect(context.append([{ kind: "condensation", condensation: {
      coveredSequence: { from: 2, through: 2 }, forgottenEventIds: [receipt.eventIds[0]!],
      summary: "invalid", policyVersion: "v1",
    } }])).rejects.toThrow(/INVALID_CONDENSATION/);
  });

  it("keeps failed mutation recovery semantics without replaying a rejected source payload", async () => {
    const store = new InMemoryContextEventStore();
    const context = createAgentContext(
      { sessionId: "page:duplicate-create", sessionKind: "page", policyVersion: "v1" },
      { eventStore: store },
    );
    const source = "SOURCE_PAYLOAD".repeat(2_000);
    await context.append([
      { kind: "instruction", scope: "system", content: "Build." },
      { kind: "user_message", content: "Continue." },
      { kind: "assistant_tool_calls", content: null, calls: [{
        id: "duplicate", name: "create_target_page", argumentsJson: JSON.stringify({ content: source }),
      }] },
      {
        kind: "tool_result", callId: "duplicate", toolName: "create_target_page",
        arguments: { path: "app/page.tsx", content: source },
        result: { success: false, error: "FILE_ALREADY_CREATED" },
      },
      { kind: "user_message", content: "Repair it." },
    ]);
    const projection = await context.project({
      model: { id: "gemini", provider: "gemini-compatible", contextWindow: 128_000 },
      tools: [], toolChoice: "auto", completionProfile: "code", pressure: "normal",
    });
    expect(JSON.stringify(projection.messages)).not.toContain(source);
    expect(JSON.stringify(projection.messages)).toContain("FILE_ALREADY_CREATED");
    expect(JSON.stringify(await store.read("page:duplicate-create"))).toContain(source);
  });

  it("projects only the latest durable task state", async () => {
    const context = createAgentContext(
      { sessionId: "page:state", sessionKind: "page", policyVersion: "v1" },
      { eventStore: new InMemoryContextEventStore() },
    );
    await context.append([
      { kind: "instruction", scope: "system", content: "Build." },
      { kind: "user_message", content: "Create home." },
      { kind: "task_state", state: { decisions: ["phase=draft_target", "revision=missing"] } },
      { kind: "task_state", state: { decisions: ["phase=build", "revision=sha256:new"] } },
    ]);
    const projection = await context.project({
      model: { id: "probe", provider: "openai", contextWindow: 128_000 },
      tools: [], toolChoice: "auto", completionProfile: "code", pressure: "normal",
    });
    expect(JSON.stringify(projection.messages)).not.toContain("draft_target");
    expect(JSON.stringify(projection.messages)).not.toContain("revision=missing");
    expect(JSON.stringify(projection.messages)).toContain("phase=build");
    expect(projection.compaction.stages).toContain("typed_checkpoint");
  });
});
