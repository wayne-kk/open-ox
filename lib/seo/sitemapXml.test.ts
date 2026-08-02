import { describe, expect, it } from "vitest";

import { sitemapIndexXml, sitemapUrlSetXml } from "./sitemapXml";

describe("sitemap XML", () => {
  it("escapes sitemap index locations", () => {
    expect(sitemapIndexXml(["https://example.com/sitemap?a=1&b=2"])).toContain(
      "https://example.com/sitemap?a=1&amp;b=2"
    );
  });

  it("emits alternates and images in a URL set", () => {
    const xml = sitemapUrlSetXml([{
      loc: "https://example.com/project",
      lastmod: "2026-08-02T00:00:00.000Z",
      alternates: { en: "https://example.com/en/project" },
      images: ["https://example.com/cover.jpg"],
    }]);
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain("<image:loc>https://example.com/cover.jpg</image:loc>");
  });
});
