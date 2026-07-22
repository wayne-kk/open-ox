import { describe, expect, it } from "vitest";
import robots from "./robots";

async function getDefaultRule() {
  const config = await robots();
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

  expect(rules).toHaveLength(1);
  return rules[0];
}

describe("site crawling policy", () => {
  it("allows search engines to crawl the public site", async () => {
    const rule = await getDefaultRule();

    expect(rule).toMatchObject({
      userAgent: "*",
      allow: "/",
    });
  });

  it("blocks localized and unprefixed private dashboards", async () => {
    const rule = await getDefaultRule();

    expect(rule?.disallow).toEqual(
      expect.arrayContaining(["/dashboard", "/en/dashboard"])
    );
  });
});
