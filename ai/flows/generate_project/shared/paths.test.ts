import { describe, expect, it } from "vitest";
import {
  buildSectionFilePath,
  slugToPageComponentRoot,
  slugToPagePath,
} from "./paths";

describe("generated route paths", () => {
  it("maps nested static slugs to App Router page files", () => {
    expect(slugToPagePath("/docs/getting-started/")).toBe(
      "app/docs/getting-started/page.tsx",
    );
  });

  it("canonicalizes home aliases to the root page", () => {
    expect(slugToPagePath("/home/")).toBe("app/page.tsx");
    expect(slugToPagePath("/index/")).toBe("app/page.tsx");
  });

  it("keeps nested route section filenames in the shared section directory", () => {
    expect(buildSectionFilePath("docs/getting-started", "Hero")).toBe(
      "components/sections/docs_getting-started_Hero.tsx",
    );
  });

  it("gives each route a distinct component namespace", () => {
    expect(slugToPageComponentRoot("docs/getting-started")).toBe(
      "components/pages/docs_getting-started",
    );
  });
});
