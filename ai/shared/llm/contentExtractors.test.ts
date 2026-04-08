import { describe, expect, it } from "vitest";
import { extractContent, extractJSON } from "./contentExtractors";

describe("contentExtractors", () => {
  it("extracts fenced json object", () => {
    const raw = "```json\n{\"a\":1,\"b\":2}\n```";
    expect(extractJSON(raw)).toBe("{\"a\":1,\"b\":2}");
  });

  it("drops duplicated tsx module tail", () => {
    const raw = [
      "```tsx",
      "export default function A(){",
      "  return <div>A</div>;",
      "}",
      'import x from "y";',
      "export default function B(){ return <div>B</div>; }",
      "```",
    ].join("\n");
    const out = extractContent(raw, "tsx");
    expect(out).toContain("export default function A");
    expect(out).not.toContain("export default function B");
  });
});
