import { describe, expect, it } from "vitest";
import { normalizeAssistantTextContent } from "./normalizeAssistantContent";

describe("normalizeAssistantTextContent", () => {
  it("trims plain strings", () => {
    expect(normalizeAssistantTextContent("  hi  ")).toBe("hi");
  });

  it("combines Gemini-style text parts arrays", () => {
    expect(
      normalizeAssistantTextContent([
        { type: "text", text: "```css\n:root{--x:1}" },
        { type: "text", text: "\n```\n" },
      ])
    ).toContain(":root");
  });

  it("returns empty for null", () => {
    expect(normalizeAssistantTextContent(null)).toBe("");
  });
});
