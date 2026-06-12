import { describe, expect, it } from "vitest";
import { sanitizeThemeSpacingTokens } from "./sanitizeThemeSpacingTokens";

describe("sanitizeThemeSpacingTokens", () => {
  it("renames colliding spacing scale keys in @theme", () => {
    const input = `@theme {
  --color-background: #000;
  --spacing-xl: 32px;
  --spacing-md: 16px;
  --spacing-section: 96px;
}`;

    expect(sanitizeThemeSpacingTokens(input)).toBe(`@theme {
  --color-background: #000;
  --spacing-gap-xl: 32px;
  --spacing-gap-md: 16px;
  --spacing-section: 96px;
}`);
  });

  it("leaves semantic spacing tokens unchanged", () => {
    const input = `--spacing-gap-tight: 8px;
--spacing-card-padding: 24px;`;
    expect(sanitizeThemeSpacingTokens(input)).toBe(input);
  });
});
