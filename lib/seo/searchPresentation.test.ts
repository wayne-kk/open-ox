import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import zhCN from "@/messages/zh-CN.json";
import { routing } from "@/i18n/routing";
import { absoluteLocaleUrl, languageAlternates } from "./siteUrl";

describe("public search presentation", () => {
  it("uses English on the unprefixed public URL", () => {
    expect(routing.defaultLocale).toBe("en");
    expect(absoluteLocaleUrl("/", "en", "https://open-ox.tech")).toBe(
      "https://open-ox.tech"
    );
    expect(absoluteLocaleUrl("/", "zh-CN", "https://open-ox.tech")).toBe(
      "https://open-ox.tech/zh-CN"
    );
    expect(languageAlternates("/", "https://open-ox.tech")["x-default"]).toBe(
      "https://open-ox.tech"
    );
  });

  it("gives search engines specific homepage summaries in both languages", () => {
    expect(en.seo.home.description.length).toBeGreaterThanOrEqual(140);
    expect(en.seo.home.description.length).toBeLessThanOrEqual(220);
    expect(zhCN.seo.home.description.length).toBeGreaterThanOrEqual(70);
    expect(zhCN.seo.home.description.length).toBeLessThanOrEqual(110);

    expect(en.seo.home.title).toContain("AI Website Builder");
    expect(en.seo.home.description).toContain("beautiful UI");
    expect(en.seo.home.description).toContain("your own account");
    expect(zhCN.seo.home.title).toContain("AI 网站构建器");
    expect(zhCN.seo.home.description).toContain("界面精美");
    expect(zhCN.seo.home.description).toContain("你自己的账户");
  });
});
