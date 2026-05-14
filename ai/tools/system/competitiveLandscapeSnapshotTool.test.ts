import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as webSearch from "@/ai/tools/system/webSearchTool";
import * as fetchRef from "@/ai/tools/system/fetchReferencePageTool";
import { executeCompetitiveLandscapeSnapshot } from "./competitiveLandscapeSnapshotTool";

describe("executeCompetitiveLandscapeSnapshot", () => {
  beforeEach(() => {
    vi.spyOn(webSearch, "executeWebSearch").mockResolvedValue({
      success: true,
      output: "Mock search hit",
    });
    vi.spyOn(fetchRef, "executeFetchReferencePage").mockResolvedValue({
      success: true,
      output: "## Mock page\n- **Title**: Example",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires industry_or_product", async () => {
    const r = await executeCompetitiveLandscapeSnapshot({});
    expect(r).toEqual(expect.objectContaining({ success: false }));
  });

  it("includes focus and search sections", async () => {
    const r = await executeCompetitiveLandscapeSnapshot({
      industry_or_product: "AI note apps",
    });
    expect(
      typeof r === "object" && r !== null && "success" in r && r.success && "output" in r
        ? r.output
        : ""
    ).toContain("AI note apps");
    expect(
      typeof r === "object" && r !== null && "success" in r && r.success && "output" in r
        ? r.output
        : ""
    ).toContain("Mock search hit");
    expect(webSearch.executeWebSearch).toHaveBeenCalled();
  });

  it("fetches https hints up to limit", async () => {
    const r = await executeCompetitiveLandscapeSnapshot({
      industry_or_product: "SaaS",
      competitor_hints: ["https://example.com/a", "https://example.com/b"],
    });
    expect(fetchRef.executeFetchReferencePage).toHaveBeenCalledTimes(2);
    expect(
      typeof r === "object" && r !== null && "success" in r && r.success && "output" in r
        ? r.output
        : ""
    ).toContain("example.com/a");
  });
});
