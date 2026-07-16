import { describe, expect, it } from "vitest";
import { extractVisualContract } from "./visualContract";

describe("extractVisualContract", () => {
  it("extracts the Visual Contract (agent) section", () => {
    const ds = `# Title

## 1. Design Philosophy
long fluff

## Visual Contract (agent)

### Color roles
- background: #111111

### Bold Factor (max 5)
1. Paper texture over cream SaaS

## 2. Design Token System
more fluff
`;
    const out = extractVisualContract(ds);
    expect(out).toContain("## Visual Contract (agent)");
    expect(out).toContain("Paper texture");
    expect(out).not.toContain("Design Token System");
    expect(out).not.toContain("long fluff");
  });

  it("falls back to token synthesis when section missing", () => {
    const ds = `# DS
--color-background: #f0e6d8
--color-foreground: #1a1a1a
--color-primary: #8b4513
--font-body: "Literata", serif
--font-display: "Playfair Display", serif
--font-header: "Playfair Display", serif
`;
    const out = extractVisualContract(ds);
    expect(out).toContain("Visual Contract");
    expect(out).toContain("#f0e6d8");
    expect(out).toContain("Literata");
    expect(out.length).toBeLessThan(3_000);
  });
});
