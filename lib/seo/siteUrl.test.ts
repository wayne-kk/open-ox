import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  absoluteLocaleUrl,
  getSiteOrigin,
  isSeoOriginLocal,
  languageAlternates,
} from "./siteUrl";

describe("siteUrl helpers", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevNode = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://open-ox.example";
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it("builds absolute locale URLs", () => {
    expect(absoluteLocaleUrl("/", "zh-CN")).toBe("https://open-ox.example");
    expect(absoluteLocaleUrl("/", "en")).toBe("https://open-ox.example/en");
    expect(absoluteLocaleUrl("/pricing", "en")).toBe(
      "https://open-ox.example/en/pricing"
    );
  });

  it("includes hreflang and x-default", () => {
    const langs = languageAlternates("/pricing");
    expect(langs["zh-CN"]).toBe("https://open-ox.example/pricing");
    expect(langs.en).toBe("https://open-ox.example/en/pricing");
    expect(langs["x-default"]).toBe("https://open-ox.example/pricing");
  });

  it("detects localhost SEO origins", () => {
    expect(isSeoOriginLocal("http://localhost:3000")).toBe(true);
    expect(isSeoOriginLocal("https://open-ox.example")).toBe(false);
  });

  it("prefers non-localhost SITE_URL", () => {
    expect(getSiteOrigin()).toBe("https://open-ox.example");
  });
});
