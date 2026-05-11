import { describe, expect, it } from "vitest";
import { parseYieldArgs } from "./runIntentAgentTurn";
import { extractLatestYieldBriefDraft, resolveCommitMergedBrief } from "./commitMergeBrief";
import type { ChatMessage } from "@/ai/shared/llm/types";

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

describe("resolveCommitMergedBrief", () => {
  const draft =
    "创建一个高端户外品牌官网单页，黑白胶片风、杂志排版、展示品牌故事与装备。".repeat(1);
  const msgs: ChatMessage[] = [
    { role: "system", content: "s" },
    {
      role: "assistant",
      content: null as unknown as string,
      tool_calls: [
        {
          id: "1",
          function: {
            name: "yield_to_user",
            arguments: JSON.stringify({
              kind: "confirm_brief",
              message: "请确认",
              brief_draft_markdown: draft,
            }),
          },
        },
      ],
    },
    { role: "user", content: "就这样，开始生成吧" },
  ];

  it("does not use trailing meta confirm when merged_brief omitted", () => {
    const out = resolveCommitMergedBrief({
      mergedBriefRaw: "",
      messages: msgs,
      tailUserMessage: "就这样，开始生成吧",
      bootstrapUserPrompt:
        "更长一些的原始需求：高山摄影装备品牌单页，胶片感、产品故事、装备展示与联系入口。",
    });
    expect(out).toContain("户外");
    expect(out).not.toMatch(/^就这样/);
  });

  it("prefers explicit long merged_brief from tool", () => {
    const long = `${draft} Extra detail from model.`;
    const out = resolveCommitMergedBrief({
      mergedBriefRaw: long,
      messages: msgs,
      tailUserMessage: "确认",
      bootstrapUserPrompt: "short",
    });
    expect(out).toBe(long);
  });

  it("extractLatestYieldBriefDraft returns latest draft", () => {
    expect(extractLatestYieldBriefDraft(msgs)).toBe(draft);
  });
});
