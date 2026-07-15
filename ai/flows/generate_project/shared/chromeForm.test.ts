import { describe, expect, it } from "vitest";
import {
  inferChromeFormFromProductType,
  needsGlobalChromeScaffold,
  normalizeChromeForm,
  normalizeSharedContracts,
  resolveChromeForm,
  shouldUsePassThroughLayout,
} from "./chromeForm";

describe("chromeForm", () => {
  it("normalizes aliases", () => {
    expect(normalizeChromeForm("Top Nav + Footer")).toBe("top-nav+footer");
    expect(normalizeChromeForm("sidebar+topbar")).toBe("sidebar");
    expect(normalizeChromeForm("page-local")).toBe("page-local");
  });

  it("infers from product type", () => {
    expect(inferChromeFormFromProductType("SaaS dashboard")).toBe("sidebar");
    expect(inferChromeFormFromProductType("immersive stream")).toBe("page-local");
    expect(inferChromeFormFromProductType("marketing website")).toBe("top-nav+footer");
  });

  it("resolveChromeForm prefers explicit then inference", () => {
    expect(resolveChromeForm({ chromeForm: "bottom-tabs" })).toBe("bottom-tabs");
    expect(resolveChromeForm({ productType: "admin console" })).toBe("sidebar");
  });

  it("classifies global vs pass-through", () => {
    expect(needsGlobalChromeScaffold("top-nav+footer")).toBe(true);
    expect(needsGlobalChromeScaffold("page-local")).toBe(false);
    expect(shouldUsePassThroughLayout("none")).toBe(true);
    expect(shouldUsePassThroughLayout("sidebar")).toBe(false);
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
