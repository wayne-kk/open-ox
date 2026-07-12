import { describe, expect, it } from "vitest";
import {
  applyCleanTabRefresh,
  cleanTabsToRefetch,
  closeCodeTab,
  expandDirsForPaths,
  filterPathsByQuery,
  needsFetchForPath,
  tabIsDirty,
  type CodeTab,
} from "./projectCodeTabs";

function tab(path: string, content: string, saved = content): CodeTab {
  return { path, content, savedContent: saved };
}

describe("projectCodeTabs", () => {
  it("detects dirty tabs", () => {
    expect(tabIsDirty(tab("a.ts", "x"))).toBe(false);
    expect(tabIsDirty(tab("a.ts", "x", "y"))).toBe(true);
  });

  it("needsFetchForPath is false on cache hit", () => {
    const tabs = [tab("components/home/cta.tsx", "code")];
    expect(needsFetchForPath(tabs, "components/home/cta.tsx")).toBe(false);
    expect(needsFetchForPath(tabs, "app/page.tsx")).toBe(true);
  });

  it("cleanTabsToRefetch skips dirty and deleted paths", () => {
    const tabs = [
      tab("keep.tsx", "a"),
      tab("dirty.tsx", "local", "disk"),
      tab("gone.tsx", "x"),
    ];
    expect(cleanTabsToRefetch(tabs, ["keep.tsx", "dirty.tsx"])).toEqual(["keep.tsx"]);
  });

  it("applyCleanTabRefresh keeps dirty, updates clean, drops missing clean", () => {
    const tabs = [
      tab("dirty.tsx", "local", "old"),
      tab("clean.tsx", "old"),
      tab("deleted.tsx", "x"),
    ];
    const next = applyCleanTabRefresh(tabs, ["dirty.tsx", "clean.tsx"], {
      "clean.tsx": "new",
    });
    expect(next).toEqual([
      tab("dirty.tsx", "local", "old"),
      tab("clean.tsx", "new"),
    ]);
  });

  it("closeCodeTab activates neighbor when closing active", () => {
    const tabs = [tab("a.ts", "1"), tab("b.ts", "2"), tab("c.ts", "3")];
    expect(closeCodeTab(tabs, "b.ts", "b.ts")).toEqual({
      tabs: [tab("a.ts", "1"), tab("c.ts", "3")],
      activePath: "c.ts",
    });
    expect(closeCodeTab(tabs, "a.ts", "a.ts").activePath).toBe("b.ts");
    expect(closeCodeTab(tabs, "a.ts", "c.ts")).toEqual({
      tabs: [tab("a.ts", "1"), tab("b.ts", "2")],
      activePath: "a.ts",
    });
  });

  it("filterPathsByQuery matches name or path", () => {
    const paths = ["components/home/cta.tsx", "app/page.tsx", "lib/utils.ts"];
    expect(filterPathsByQuery(paths, "cta")).toEqual(["components/home/cta.tsx"]);
    expect(filterPathsByQuery(paths, "app/")).toEqual(["app/page.tsx"]);
    expect(filterPathsByQuery(paths, "  ")).toEqual(paths);
  });

  it("expandDirsForPaths expands ancestors of active/filtered files", () => {
    expect([...expandDirsForPaths(["components/home/cta.tsx"])].sort()).toEqual([
      "components",
      "components/home",
    ]);
  });
});
