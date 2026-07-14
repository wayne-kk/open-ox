import { describe, expect, it } from "vitest";
import { shouldSuggestModifyBoard } from "./shouldSuggestModifyBoard";

describe("shouldSuggestModifyBoard", () => {
  it("suggests for broad code_change when Studio opts in", () => {
    expect(
      shouldSuggestModifyBoard(
        { category: "code_change", scope: "broad" },
        { preferBoardSuggest: true }
      )
    ).toBe(true);
  });

  it("does not suggest broad without preferBoardSuggest (headless-safe)", () => {
    expect(
      shouldSuggestModifyBoard({ category: "code_change", scope: "broad" })
    ).toBe(false);
  });

  it("does not suggest for narrow code_change", () => {
    expect(
      shouldSuggestModifyBoard(
        { category: "code_change", scope: "narrow" },
        { preferBoardSuggest: true }
      )
    ).toBe(false);
  });

  it("forceBoard overrides narrow", () => {
    expect(
      shouldSuggestModifyBoard(
        { category: "code_change", scope: "narrow" },
        { forceBoard: true }
      )
    ).toBe(true);
  });

  it("forceSingleModify blocks broad suggestion", () => {
    expect(
      shouldSuggestModifyBoard(
        { category: "code_change", scope: "broad" },
        { preferBoardSuggest: true, forceSingleModify: true }
      )
    ).toBe(false);
  });
});
