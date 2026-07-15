import { describe, expect, it } from "vitest";
import {
  needsGlobalChromeScaffold,
  normalizeChromeForm,
  normalizeSharedContracts,
  resolveChromeForm,
  shouldUsePassThroughLayout,
} from "./chromeForm";

describe("chromeForm", () => {
  it("normalizes aliases from agent-provided strings", () => {
    expect(normalizeChromeForm("Top Nav + Footer")).toBe("top-nav+footer");
    expect(normalizeChromeForm("sidebar+topbar")).toBe("sidebar");
    expect(normalizeChromeForm("page-local")).toBe("page-local");
  });

  it("resolveChromeForm only normalizes explicit agent values — never invents from productType", () => {
    expect(resolveChromeForm({ chromeForm: "bottom-tabs" })).toBe("bottom-tabs");
    expect(resolveChromeForm({})).toBe("unspecified");
    expect(resolveChromeForm({ chromeForm: undefined })).toBe("unspecified");
    expect(resolveChromeForm({ chromeForm: "" })).toBe("unspecified");
  });

  it("classifies global vs pass-through from agent-chosen labels only", () => {
    expect(needsGlobalChromeScaffold("top-nav+footer")).toBe(true);
    expect(needsGlobalChromeScaffold("page-local")).toBe(false);
    expect(needsGlobalChromeScaffold("unspecified")).toBe(false);
    expect(shouldUsePassThroughLayout("none")).toBe(true);
    expect(shouldUsePassThroughLayout("sidebar")).toBe(false);
    expect(shouldUsePassThroughLayout("unspecified")).toBe(false);
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
});
