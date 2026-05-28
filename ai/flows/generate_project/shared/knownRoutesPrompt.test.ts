import { describe, expect, it } from "vitest";
import { formatKnownRoutesMarkdown } from "./knownRoutesPrompt";

describe("formatKnownRoutesMarkdown", () => {
  it("maps home to / and other slugs to /slug", () => {
    const md = formatKnownRoutesMarkdown([
      { title: "Home", slug: "home" },
      { title: "Pricing", slug: "pricing" },
    ]);
    expect(md).toContain("| Home | `home` | `/` |");
    expect(md).toContain("| Pricing | `pricing` | `/pricing` |");
    expect(md).toContain("next/link");
  });

  it("returns empty string for empty pages", () => {
    expect(formatKnownRoutesMarkdown([])).toBe("");
  });
});
