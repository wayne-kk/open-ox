import { describe, expect, it } from "vitest";
import { parseYieldArgs } from "./runIntentAgentTurn";

describe("parseYieldArgs", () => {
  it("defaults kind and message", () => {
    const r = parseYieldArgs({});
    expect(r.kind).toBe("clarify");
    expect(r.message.length).toBeGreaterThan(10);
    expect(r.suggestedReplies).toEqual([]);
    expect(r.options).toEqual([]);
  });

  it("parses options and brief draft", () => {
    const r = parseYieldArgs({
      kind: "confirm_brief",
      message: "OK?",
      suggested_replies: ["  yes  "],
      options: [{ id: "a", label: "A", hint: "h" }],
      brief_draft_markdown: " ## x ",
    });
    expect(r.kind).toBe("confirm_brief");
    expect(r.suggestedReplies).toEqual(["yes"]);
    expect(r.options[0]).toEqual({ id: "a", label: "A", hint: "h" });
    expect(r.briefDraftMarkdown).toBe("## x");
  });
});
