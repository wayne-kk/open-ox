import { describe, expect, it } from "vitest";
import { extractGoogleImageUrlsFromText } from "./userProvidedImageEnforcement";
import { resolvePageImplementAgentRuleIds as resolveRules } from "./agentRuleBundles";

describe("extractGoogleImageUrlsFromText", () => {
  it("dedupes googleusercontent URLs from prompt text", () => {
    const url =
      "https://lh3.googleusercontent.com/places/ANXAkqFsdqeSIn9vUYegDIWsB1OozY7FHKJvW4zGoezFNI6UL9BZYC4w54fkH66SQgOLqwueELcCsDDnbkjR8GqbI57pBDL0ayKYAa4=s4800-w1200";
    const text = `Hero: ${url}\nAgain: ${url}`;
    expect(extractGoogleImageUrlsFromText(text)).toEqual([url]);
  });
});

describe("resolvePageImplementAgentRuleIds", () => {
  it("prepends section.userProvidedImages when user photos exist", () => {
    const ids = resolveRules({ userProvidedImageCount: 3 });
    expect(ids.indexOf("section.userProvidedImages")).toBeLessThan(
      ids.indexOf("section.default")
    );
  });
});
