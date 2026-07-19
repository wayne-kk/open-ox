import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  needsGlobalChromeScaffold,
  normalizeChromeForm,
  normalizeSharedContracts,
  resolveChromeForm,
} from "./chromeForm";

describe("chromeForm", () => {
  it("normalizes aliases from agent-provided strings", () => {
    expect(normalizeChromeForm("Top Nav + Footer")).toBe("top-nav+footer");
    expect(normalizeChromeForm("sidebar+topbar")).toBe("sidebar");
    // Legacy page-local → Scaffold decides (unspecified)
    expect(normalizeChromeForm("page-local")).toBe("unspecified");
    expect(normalizeChromeForm("Page Local")).toBe("unspecified");
  });

  it("resolveChromeForm only normalizes explicit agent values — never invents from productType", () => {
    expect(resolveChromeForm({ chromeForm: "bottom-tabs" })).toBe("bottom-tabs");
    expect(resolveChromeForm({})).toBe("unspecified");
    expect(resolveChromeForm({ chromeForm: undefined })).toBe("unspecified");
    expect(resolveChromeForm({ chromeForm: "" })).toBe("unspecified");
    expect(resolveChromeForm({ chromeForm: "page-local" })).toBe("unspecified");
  });

  it("classifies global forms; chromeForm never selects pass-through", () => {
    expect(needsGlobalChromeScaffold("top-nav+footer")).toBe(true);
    expect(needsGlobalChromeScaffold("unspecified")).toBe(false);
    expect(needsGlobalChromeScaffold("none")).toBe(false);
  });

  it("normalizes shared contracts", () => {
    const contracts = normalizeSharedContracts([
      {
        entityName: "Item",
        fields: ["title", "href"],
        sharedComponentPath: "components/shared/ItemCard.tsx",
        listSlug: "items",
        detailRoutePattern: "/items/[id]",
      },
      { name: "bad" },
    ]);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].entityName).toBe("Item");
    expect(contracts[0].sharedComponentPath).toBe("components/shared/ItemCard.tsx");
  });

  it("orchestration source never reintroduces page-local pass-through skip", () => {
    const runSrc = readFileSync(
      join(__dirname, "../runGenerateProject.ts"),
      "utf8"
    );
    const formSrc = readFileSync(join(__dirname, "chromeForm.ts"), "utf8");
    expect(runSrc).not.toContain("pass-through (page-local shell)");
    expect(runSrc).not.toContain("shouldUsePassThroughLayout");
    expect(formSrc).not.toContain("shouldUsePassThroughLayout");
    // Enum must not include page-local (legacy alias → unspecified is fine).
    expect(formSrc).toMatch(
      /export const CHROME_FORMS = \[[^\]]*"none"[^\]]*\] as const/
    );
    expect(formSrc).not.toMatch(
      /export const CHROME_FORMS = \[[^\]]*"page-local"[^\]]*\] as const/
    );
  });
});
