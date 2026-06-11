import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { collectIntentAgentImageSourceTexts } from "./collectImageSourceTexts";

const URL1 =
  "https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto1=s4800-w1200";
const URL2 =
  "https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto2=s4800-w1200";

describe("collectIntentAgentImageSourceTexts", () => {
  it("includes bootstrap, user turns, and yield drafts", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: `Follow-up with ${URL2}` },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "tc1",
            type: "function",
            function: {
              name: "yield_to_user",
              arguments: JSON.stringify({
                kind: "confirm_brief",
                message: "ok",
                brief_draft_markdown: `Draft ${URL2}`,
              }),
            },
          },
        ],
      },
    ];
    const texts = collectIntentAgentImageSourceTexts({
      bootstrapUserPrompt: `Initial ${URL1}`,
      messages,
    });
    const joined = texts.join("\n");
    expect(joined).toContain(URL1);
    expect(joined).toContain(URL2);
  });
});
