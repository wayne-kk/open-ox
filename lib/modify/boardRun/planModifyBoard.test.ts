import { describe, expect, it } from "vitest";
import { AdvanceBoardRunError, BOARD_RUN_MAX_TASKS } from "./boardRunTypes";
import { parseModifyBoardPlan } from "./planModifyBoard";

describe("parseModifyBoardPlan", () => {
  it("accepts 2–6 valid tasks", () => {
    const plan = parseModifyBoardPlan({
      tasks: [
        { title: "Pricing", instruction: "对齐 Pricing" },
        { title: "SEO", instruction: "补 meta" },
      ],
    });
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]).toEqual({ title: "Pricing", instruction: "对齐 Pricing" });
  });

  it("rejects fewer than 2 tasks", () => {
    expect(() =>
      parseModifyBoardPlan({
        tasks: [{ title: "Only", instruction: "one" }],
      })
    ).toThrow(AdvanceBoardRunError);
  });

  it("rejects more than max tasks", () => {
    const tasks = Array.from({ length: BOARD_RUN_MAX_TASKS + 1 }, (_, i) => ({
      title: `T${i}`,
      instruction: `do ${i}`,
    }));
    expect(() => parseModifyBoardPlan({ tasks })).toThrow(AdvanceBoardRunError);
  });

  it("drops invalid items then validates cardinality", () => {
    expect(() =>
      parseModifyBoardPlan({
        tasks: [
          { title: "A", instruction: "ok" },
          { title: "", instruction: "bad" },
          { title: "B", instruction: "ok2" },
        ],
      })
    ).not.toThrow();
    expect(
      parseModifyBoardPlan({
        tasks: [
          { title: "A", instruction: "ok" },
          { title: "", instruction: "bad" },
          { title: "B", instruction: "ok2" },
        ],
      }).tasks
    ).toHaveLength(2);
  });
});
