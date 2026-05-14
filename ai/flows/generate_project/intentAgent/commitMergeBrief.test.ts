import { describe, expect, it } from "vitest";
import { resolveCommitMergedBrief, shouldSkipNamingFromBlueprintTitle } from "./commitMergeBrief";
import type { ChatMessage } from "@/ai/shared/llm/types";

describe("resolveCommitMergedBrief", () => {
  const draft =
    "创建一个高端户外品牌官网单页，黑白胶片风、杂志排版、展示品牌故事与装备。";
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

  it("treats repetitive long agreement blobs as non-substantive", () => {
    const span = "yes ".repeat(30).trim();
    const out = resolveCommitMergedBrief({
      mergedBriefRaw: span,
      messages: msgs,
      tailUserMessage: span,
      bootstrapUserPrompt: "",
      substance: {
        mergedBriefFieldSubstantive: false,
        tailSubstantive: false,
        bootstrapSubstantive: false,
      },
    });
    expect(out).toContain("户外");
  });
});

describe("shouldSkipNamingFromBlueprintTitle", () => {
  it("allows short real titles", () => {
    expect(shouldSkipNamingFromBlueprintTitle("WAR ROOM")).toBe(false);
    expect(shouldSkipNamingFromBlueprintTitle("故宫")).toBe(false);
  });

  it("skips empty, sentence-like, or markdown-shaped titles", () => {
    expect(shouldSkipNamingFromBlueprintTitle("")).toBe(true);
    expect(shouldSkipNamingFromBlueprintTitle("   ")).toBe(true);
    expect(shouldSkipNamingFromBlueprintTitle("a\nb")).toBe(true);
    expect(shouldSkipNamingFromBlueprintTitle("# Title")).toBe(true);
    expect(shouldSkipNamingFromBlueprintTitle("x".repeat(100))).toBe(true);
  });
});
