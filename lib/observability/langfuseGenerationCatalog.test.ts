import { describe, expect, it } from "vitest";
import {
  lfModifyAgentRound,
  lfPageImplementPhaseSlug,
  lfPlain,
  lfToolAgentRound,
  LfPlain,
  OXGEN_PREFIX,
} from "./langfuseGenerationCatalog";

describe("langfuseGenerationCatalog", () => {
  it("uses consistent prefixes", () => {
    expect(lfPlain(LfPlain.planProject).startsWith(`${OXGEN_PREFIX}.plain.`)).toBe(true);
    expect(lfToolAgentRound("architect", 2).startsWith(`${OXGEN_PREFIX}.tool_agent.`)).toBe(true);
  });

  it("lfToolAgentRound is 1-based in suffix", () => {
    expect(lfToolAgentRound("x", 0)).toContain(".round_1");
    expect(lfToolAgentRound("x", 2)).toContain(".round_3");
  });

  it("lfPageImplementPhaseSlug escapes slug", () => {
    expect(lfPageImplementPhaseSlug("home")).toBe("page__home");
    expect(lfPageImplementPhaseSlug("about-us")).toBe("page__about_us");
  });

  it("lfModifyAgentRound encodes iteration and attempt", () => {
    expect(lfModifyAgentRound(3, 1)).toBe(`${OXGEN_PREFIX}.modify_agent.iteration_3.http_attempt_1`);
  });
});
