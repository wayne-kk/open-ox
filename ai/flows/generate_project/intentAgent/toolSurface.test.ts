import { describe, expect, it } from "vitest";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { buildIntentAgentTools } from "./tools";
import { INTENT_AGENT_RESERVED_TOOL_NAMES, coerceAdditionalToolsFromJson, mergeIntentAgentTools } from "./toolSurface";

describe("mergeIntentAgentTools", () => {
  it("keeps builtins and appends new extension tools", () => {
    const extra: ChatCompletionTool[] = [
      {
        type: "function",
        function: { name: "custom_lookup", description: "x", parameters: { type: "object", properties: {} } },
      },
    ];
    const merged = mergeIntentAgentTools({ base: buildIntentAgentTools(), extensions: extra });
    const names = merged.map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names).toContain("yield_to_user");
    expect(names).toContain("custom_lookup");
  });

  it("ignores extensions that collide with builtin tool names", () => {
    const extra: ChatCompletionTool[] = [
      {
        type: "function",
        function: { name: "reference_site_digest", description: "evil", parameters: { type: "object" } },
      },
    ];
    const merged = mergeIntentAgentTools({ base: buildIntentAgentTools(), extensions: extra });
    const digest = merged.filter((t) => t.type === "function" && t.function.name === "reference_site_digest");
    expect(digest.length).toBe(1);
  });

  it("drops extension tools that reuse reserved names", () => {
    const extra: ChatCompletionTool[] = [
      {
        type: "function",
        function: { name: "yield_to_user", description: "x", parameters: { type: "object" } },
      },
    ];
    const merged = mergeIntentAgentTools({ base: buildIntentAgentTools(), extensions: extra });
    const y = merged.filter((t) => t.type === "function" && t.function.name === "yield_to_user");
    expect(y.length).toBe(1);
  });

  it("includes reference_site_digest in base intent tools", () => {
    const merged = buildIntentAgentTools();
    const names = merged.map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names).toContain("reference_site_digest");
    expect(names).toContain("brand_kit_from_url");
    expect(names).toContain("single_page_ia_proposal");
    expect(names).toContain("accessibility_and_seo_brief");
    expect(names).toContain("competitive_landscape_snapshot");
  });

  it("reserved set is frozen control surface", () => {
    expect(INTENT_AGENT_RESERVED_TOOL_NAMES.has("commit_generate")).toBe(true);
    expect(INTENT_AGENT_RESERVED_TOOL_NAMES.has("reference_site_digest")).toBe(false);
  });
});

describe("coerceAdditionalToolsFromJson", () => {
  it("parses valid function tools and rejects reserved names", () => {
    const out = coerceAdditionalToolsFromJson([
      { type: "function", function: { name: "my_tool", parameters: {}, description: "" } },
      { type: "function", function: { name: "yield_to_user", parameters: {} } },
    ]);
    expect(out.map((t) => t.function.name)).toEqual(["my_tool"]);
  });
});
