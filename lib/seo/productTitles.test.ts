import { describe, expect, it } from "vitest";
import {
  adminPageTitle,
  docsPageTitle,
  productPageTitle,
  projectPageTitle,
  studioPageTitle,
} from "./productTitles";

describe("product titles", () => {
  it("localizes product pages and falls back to English", () => {
    expect(productPageTitle("dashboard", "zh-CN")).toBe("我的项目 · Open-OX");
    expect(productPageTitle("dashboard", "en")).toBe("My Projects · Open-OX");
    expect(productPageTitle("dashboard", "fr")).toBe("My Projects · Open-OX");
  });

  it("puts the project name first for project and Studio tabs", () => {
    expect(projectPageTitle("咖啡品牌官网", "zh-CN")).toBe(
      "咖啡品牌官网 · Open-OX",
    );
    expect(studioPageTitle("咖啡品牌官网", "zh-CN")).toBe(
      "咖啡品牌官网 · Studio · Open-OX",
    );
  });

  it("expresses active Studio states", () => {
    expect(studioPageTitle("Portfolio", "en", "generating")).toBe(
      "Building: Portfolio · Open-OX",
    );
    expect(studioPageTitle("Portfolio", "en", "attention")).toBe(
      "Needs attention: Portfolio · Open-OX",
    );
  });

  it("marks admin tabs clearly", () => {
    expect(adminPageTitle("users", "zh-CN")).toBe("用户管理 · Admin · Open-OX");
    expect(adminPageTitle("users", "en")).toBe("Users · Admin · Open-OX");
  });

  it("gives docs subpages server-ready titles", () => {
    expect(docsPageTitle("blueprint", "zh-CN")).toBe("项目蓝图 · Open-OX Docs");
  });
});
