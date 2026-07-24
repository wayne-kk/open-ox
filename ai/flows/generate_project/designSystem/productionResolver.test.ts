import { beforeEach, describe, expect, it, vi } from "vitest";

const { callLLMWithMeta } = vi.hoisted(() => ({
  callLLMWithMeta: vi.fn(),
}));

vi.mock("../shared/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/llm")>()),
  callLLMWithMeta,
}));

import {
  MATCHER_OUTPUT_MAX_TOKENS,
  judgeCandidates,
  parseDesignSystemMatcherResponse,
} from "./productionResolver";
import { createFileDesignSystemSkillCatalog } from "./catalog";
import {
  beginModelRuntimeContext,
  setStepThinkingLevel,
} from "@/lib/config/models";

const catalog = createFileDesignSystemSkillCatalog();
const request = {
  userInput: "Build a dark editorial site without pastel colors",
  designIntentMarkdown: "Style: newsprint. Forbidden: pastel colors",
};
const candidates = [
  {
    skillId: "newsprint",
    score: 0.55,
    matchedSignals: ["alias:newsprint"],
    conflicts: [],
  },
];

function completion(content: string) {
  return { content, model: "gemini-3-flash-preview" };
}

describe("production design-system matcher", () => {
  beforeEach(() => {
    callLLMWithMeta.mockReset();
    beginModelRuntimeContext();
  });

  it("honors the configured thinking level for the matcher step", async () => {
    setStepThinkingLevel("match_design_system_skill", "low");
    callLLMWithMeta.mockResolvedValue(
      completion(
        JSON.stringify({
          skillId: "newsprint",
          confidence: 0.94,
          evidence: ["explicit newsprint direction"],
          conflicts: [],
          reason: "Strong fit",
        }),
      ),
    );

    await judgeCandidates(catalog, request, candidates);

    expect(callLLMWithMeta.mock.calls[0]?.[5]).toMatchObject({
      thinkingLevel: "low",
    });
  });

  it.each(["null", "none", "", "no_match"])(
    "normalizes the string sentinel %j to no skill",
    (skillId) => {
      expect(
        parseDesignSystemMatcherResponse(
          JSON.stringify({
            skillId,
            confidence: 0.2,
            evidence: [],
            conflicts: [],
            reason: "No strong match",
          }),
        ).skillId,
      ).toBeNull();
    },
  );

  it("reserves enough output budget and retries one truncated JSON response", async () => {
    callLLMWithMeta
      .mockResolvedValueOnce(completion('{"skillId":"newsprint",'))
      .mockResolvedValueOnce(
        completion(
          JSON.stringify({
            skillId: "newsprint",
            confidence: 0.94,
            evidence: ["explicit newsprint direction"],
            conflicts: [],
            reason: "Strong fit",
          }),
        ),
      );

    const result = await judgeCandidates(catalog, request, candidates);

    expect(result.decision.skillId).toBe("newsprint");
    expect(callLLMWithMeta).toHaveBeenCalledTimes(2);
    expect(MATCHER_OUTPUT_MAX_TOKENS).toBeGreaterThanOrEqual(1024);
    expect(callLLMWithMeta.mock.calls[0]?.[3]).toBe(
      MATCHER_OUTPUT_MAX_TOKENS,
    );
  });

  it("classifies a response that remains truncated after retry", async () => {
    callLLMWithMeta.mockResolvedValue(completion('{"skillId":"newsprint",'));

    await expect(judgeCandidates(catalog, request, candidates)).rejects.toMatchObject({
      matcherFailureReason: "matcher_response_truncated",
    });
    expect(callLLMWithMeta).toHaveBeenCalledTimes(2);
  });

  it("classifies a matcher request failure without pretending it is JSON", async () => {
    callLLMWithMeta.mockRejectedValue(new Error("gateway unavailable"));

    await expect(judgeCandidates(catalog, request, candidates)).rejects.toMatchObject({
      matcherFailureReason: "matcher_request_failed",
      matcherFailureDetail: expect.objectContaining({
        message: "gateway unavailable",
      }),
    });
    expect(callLLMWithMeta).toHaveBeenCalledOnce();
  });

  it("retries when the LLM gateway reports an empty truncated response", async () => {
    callLLMWithMeta
      .mockRejectedValueOnce(
        new Error("LLM response truncated (max_tokens reached; visible content empty)"),
      )
      .mockResolvedValueOnce(
        completion(
          JSON.stringify({
            skillId: "newsprint",
            confidence: 0.91,
            evidence: ["newsprint"],
            conflicts: [],
            reason: "Strong fit",
          }),
        ),
      );

    await expect(judgeCandidates(catalog, request, candidates)).resolves.toMatchObject({
      decision: { skillId: "newsprint" },
    });
    expect(callLLMWithMeta).toHaveBeenCalledTimes(2);
  });
});
