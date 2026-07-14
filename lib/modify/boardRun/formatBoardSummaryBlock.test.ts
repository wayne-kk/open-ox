import { describe, expect, it } from "vitest";
import { advanceBoardRun } from "./advanceBoardRun";
import { formatBoardSummaryBlock } from "./formatBoardSummaryBlock";

describe("formatBoardSummaryBlock", () => {
  it("includes goal, completed titles, and current card", () => {
    let seq = 0;
    const opts = (online: boolean) => ({
      online,
      now: () => "t0",
      newId: () => `id-${++seq}`,
    });

    let run = advanceBoardRun(
      null,
      {
        type: "propose",
        projectId: "p",
        goal: "整站收拾",
        tasks: [
          { title: "Pricing", instruction: "改 Pricing" },
          { title: "SEO", instruction: "补 SEO" },
        ],
      },
      opts(false)
    ).run;
    run = advanceBoardRun(
      run,
      {
        type: "confirm",
        tasks: run.tasks.map((t) => ({ title: t.title, instruction: t.instruction })),
      },
      opts(true)
    ).run;
    const firstId = run.tasks[0]!.id;
    run = advanceBoardRun(
      run,
      { type: "cardSucceeded", taskId: firstId },
      opts(false)
    ).run;

    const block = formatBoardSummaryBlock(run, run.tasks[1]!.id);
    expect(block).toContain("整站收拾");
    expect(block).toContain("[done] Pricing");
    expect(block).toContain("Current card: SEO");
  });
});
