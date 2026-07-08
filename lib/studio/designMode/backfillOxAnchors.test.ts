import { describe, expect, it } from "vitest";

import {
  addOxIdToJsxOpeningLine,
  backfillOxAnchorsInSource,
  slugFromSectionBasename,
} from "./backfillOxAnchors";

describe("slugFromSectionBasename", () => {
  it("kebab-cases PascalCase filenames", () => {
    expect(slugFromSectionBasename("Hero.tsx")).toBe("hero");
    expect(slugFromSectionBasename("FeatureGrid.tsx")).toBe("feature-grid");
  });
});

describe("addOxIdToJsxOpeningLine", () => {
  it("inserts data-ox-id on opening tag", () => {
    const out = addOxIdToJsxOpeningLine('  <h1 className="text-4xl">', "hero-headline");
    expect(out).toContain('data-ox-id="hero-headline"');
  });

  it("skips when anchor already present", () => {
    expect(addOxIdToJsxOpeningLine('  <h1 data-ox-id="x">', "hero-headline")).toBeNull();
  });
});

describe("backfillOxAnchorsInSource", () => {
  it("adds anchors to section, headline, and cta", () => {
    const input = `<section className="py-20">
  <h1 className="text-4xl">Title</h1>
  <p className="text-muted">Body</p>
  <button className="btn">Go</button>
</section>`;
    const { content, added } = backfillOxAnchorsInSource(input, "hero");
    expect(added).toBeGreaterThanOrEqual(4);
    expect(content).toContain('data-ox-id="hero-root"');
    expect(content).toContain('data-ox-id="hero-headline"');
    expect(content).toContain('data-ox-id="hero-copy-1"');
    expect(content).toContain('data-ox-id="hero-cta-1"');
  });
});
