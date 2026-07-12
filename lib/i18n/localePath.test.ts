import { describe, expect, it } from "vitest";
import { stripLocalePrefix, withLocalePrefix } from "./localePath";

describe("stripLocalePrefix", () => {
  it("leaves default-locale paths unchanged", () => {
    expect(stripLocalePrefix("/dashboard")).toBe("/dashboard");
    expect(stripLocalePrefix("/settings/appearance")).toBe("/settings/appearance");
  });

  it("strips en prefix", () => {
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/en/studio/abc")).toBe("/studio/abc");
    expect(stripLocalePrefix("/en/settings/integrations")).toBe("/settings/integrations");
  });

  it("strips zh-CN prefix when present", () => {
    expect(stripLocalePrefix("/zh-CN")).toBe("/");
    expect(stripLocalePrefix("/zh-CN/pricing")).toBe("/pricing");
  });
});

describe("withLocalePrefix", () => {
  it("omits default locale", () => {
    expect(withLocalePrefix("/dashboard", "zh-CN")).toBe("/dashboard");
  });

  it("prefixes en", () => {
    expect(withLocalePrefix("/", "en")).toBe("/en");
    expect(withLocalePrefix("/auth", "en")).toBe("/en/auth");
  });
});
