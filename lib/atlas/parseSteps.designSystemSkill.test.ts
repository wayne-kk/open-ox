import { describe, expect, it } from "vitest";
import type { BuildStep } from "@/ai/flows/generate_project/types";
import { parseStepsToTopology } from "./parseSteps";

describe("design-system skill topology", () => {
  it("renders matching as a decision node with the selected skill hint", () => {
    const steps: BuildStep[] = [
      {
        step: "match_design_system_skill",
        status: "ok",
        detail: "matched:academia@1 · confidence:96%",
        skillId: "academia",
        timestamp: 10,
        duration: 20,
      },
    ];

    const graph = parseStepsToTopology(steps, 0);

    expect(graph.nodes[0]).toMatchObject({
      step: "match_design_system_skill",
      stage: "design",
      kind: "decision",
      skillHint: "academia",
    });
  });
});
