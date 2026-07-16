import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSubagentRegistryForTests, runResearchSubagent } from "./index";

vi.mock("@/ai/shared/llm/toolLoop", () => ({
  callLLMWithTools: vi.fn(),
}));

import { callLLMWithTools } from "@/ai/shared/llm/toolLoop";

const mockedCallLLM = vi.mocked(callLLMWithTools);

afterEach(() => {
  resetSubagentRegistryForTests();
  vi.clearAllMocks();
});

describe("runResearchSubagent", () => {
  it("skips when no marketing-site URLs are present", async () => {
    const result = await runResearchSubagent({
      userBrief: "Build a cafe site with https://lh3.googleusercontent.com/p/abc=s1360",
    });
    expect(result).toBeNull();
    expect(mockedCallLLM).not.toHaveBeenCalled();
  });

  it("skips when enableSubagents is false", async () => {
    const result = await runResearchSubagent({
      userBrief: "像 https://vercel.com 一样",
      enableSubagents: false,
    });
    expect(result).toBeNull();
    expect(mockedCallLLM).not.toHaveBeenCalled();
  });

  it("runs research kind with reference tools for marketing URLs", async () => {
    mockedCallLLM.mockResolvedValue({
      content: "## Reference research brief\n### Sites reviewed\n- https://vercel.com",
      toolCalls: [],
    });

    const result = await runResearchSubagent({
      userBrief: "参考 https://vercel.com 做官网",
    });

    expect(result?.ok).toBe(true);
    expect(result?.kind).toBe("research");
    expect(result?.summary).toContain("vercel.com");
    expect(mockedCallLLM).toHaveBeenCalledOnce();
    const callArgs = mockedCallLLM.mock.calls[0]?.[0];
    expect(callArgs?.langfusePhase).toBe("subagent_research");
    expect(callArgs?.tools.map((t) => t.function.name).sort()).toEqual(
      [
        "fetch_reference_page",
        "reference_site_digest",
        "think",
        "web_search",
      ].sort()
    );
  });
});
