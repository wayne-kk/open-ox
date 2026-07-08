import { describe, expect, it } from "vitest";

import {
  findClassNameLineNearAnchor,
  findOxAnchorLineIndices,
  findTextLineNearAnchor,
  findUniqueOxAnchorLineIndex,
  isValidOxId,
  oxIdSourceLiterals,
} from "./anchor";

const FIXTURE = `<section data-ox-id="hero-root" className="py-20">
  <h1
    data-ox-id="hero-headline"
    className="text-4xl text-white"
  >
    独立出版
  </h1>
  <a data-ox-id="hero-cta-primary" className="btn" href="#">开始</a>
</section>`;

describe("isValidOxId", () => {
  it("accepts kebab-case ids", () => {
    expect(isValidOxId("hero-headline")).toBe(true);
  });

  it("rejects invalid ids", () => {
    expect(isValidOxId("Hero")).toBe(false);
    expect(isValidOxId("")).toBe(false);
    expect(isValidOxId(null)).toBe(false);
  });
});

describe("findOxAnchorLineIndices", () => {
  it("finds all anchor lines", () => {
    expect(findOxAnchorLineIndices(FIXTURE, "hero-headline").length).toBe(1);
    expect(findOxAnchorLineIndices(FIXTURE, "hero-root").length).toBe(1);
  });

  it("returns empty when missing", () => {
    expect(findOxAnchorLineIndices(FIXTURE, "missing-id")).toEqual([]);
  });
});

describe("findUniqueOxAnchorLineIndex", () => {
  it("returns line when unique", () => {
    expect(findUniqueOxAnchorLineIndex(FIXTURE, "hero-cta-primary")).not.toBeNull();
  });
});

describe("findClassNameLineNearAnchor", () => {
  it("finds className on anchor or next lines", () => {
    const lines = FIXTURE.split("\n");
    const anchor = findUniqueOxAnchorLineIndex(FIXTURE, "hero-headline")!;
    expect(findClassNameLineNearAnchor(lines, anchor)).not.toBeNull();
  });
});

describe("findTextLineNearAnchor", () => {
  it("finds unique text below anchor", () => {
    const lines = FIXTURE.split("\n");
    const anchor = findUniqueOxAnchorLineIndex(FIXTURE, "hero-headline")!;
    expect(findTextLineNearAnchor(lines, anchor, "独立出版")).not.toBeNull();
  });
});

describe("oxIdSourceLiterals", () => {
  it("includes double-quoted form", () => {
    expect(oxIdSourceLiterals("hero-root")[0]).toBe('data-ox-id="hero-root"');
  });
});
