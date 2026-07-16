import { describe, expect, it } from "vitest";
import {
  normalizeGallerySearchQuery,
  normalizeTagName,
  shouldSearchAcrossFolders,
} from "./tagManager";

describe("normalizeTagName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTagName("  client   work  ")).toBe("client work");
  });

  it("returns null for blank input", () => {
    expect(normalizeTagName("   ")).toBeNull();
  });

  it("caps length at 32", () => {
    const long = "a".repeat(40);
    expect(normalizeTagName(long)?.length).toBe(32);
  });
});

describe("normalizeGallerySearchQuery", () => {
  it("returns null for empty / whitespace", () => {
    expect(normalizeGallerySearchQuery("")).toBeNull();
    expect(normalizeGallerySearchQuery("   ")).toBeNull();
    expect(normalizeGallerySearchQuery(null)).toBeNull();
  });

  it("strips ilike / PostgREST metacharacters", () => {
    expect(normalizeGallerySearchQuery("foo%bar_baz,qux")).toBe("foo bar baz qux");
  });

  it("keeps a normal Chinese / English query", () => {
    expect(normalizeGallerySearchQuery("  咖啡店 landing  ")).toBe("咖啡店 landing");
  });
});

describe("shouldSearchAcrossFolders", () => {
  it("expands all/root when search or tag filter is active", () => {
    expect(shouldSearchAcrossFolders("all", true)).toBe(true);
    expect(shouldSearchAcrossFolders("uncategorized", true)).toBe(true);
    expect(shouldSearchAcrossFolders("all", false)).toBe(false);
    expect(shouldSearchAcrossFolders("all", false, true)).toBe(true);
    expect(shouldSearchAcrossFolders("folder-uuid", true)).toBe(false);
    expect(shouldSearchAcrossFolders("folder-uuid", false, true)).toBe(false);
  });
});
