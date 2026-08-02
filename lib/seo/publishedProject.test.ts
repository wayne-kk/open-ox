import { describe, expect, it } from "vitest";

import {
  indexableProjectUrl,
  isProjectIndexable,
  isProjectPublicShowcase,
  projectSeoSlug,
} from "./publishedProject";

describe("published project SEO", () => {
  const published = {
    id: "project-123",
    name: "AI Resume Builder",
    publishPreview: true,
    listing: "listed" as const,
    searchIndexingEnabled: true,
    staticPreviewSyncedAt: "2026-08-02T08:00:00.000Z",
    deletedAt: null,
  };

  it("builds a stable locale-aware public URL", () => {
    expect(indexableProjectUrl(published, "zh-CN", "https://open-ox.tech")).toBe(
      "https://open-ox.tech/showcase/project-123/ai-resume-builder"
    );
    expect(indexableProjectUrl(published, "en", "https://open-ox.tech")).toBe(
      "https://open-ox.tech/en/showcase/project-123/ai-resume-builder"
    );
  });

  it("normalizes non-Latin and punctuation-only titles to a stable fallback", () => {
    expect(projectSeoSlug("AI 简历 / Builder")).toBe("ai-builder");
    expect(projectSeoSlug("中文项目")).toBe("project");
  });

  it("indexes only listed, opted-in projects with a static preview", () => {
    expect(isProjectIndexable(published)).toBe(true);
    expect(isProjectIndexable({ ...published, publishPreview: false })).toBe(false);
    expect(isProjectIndexable({ ...published, listing: "unlisted" })).toBe(false);
    expect(isProjectIndexable({ ...published, searchIndexingEnabled: false })).toBe(false);
    expect(isProjectIndexable({ ...published, staticPreviewSyncedAt: null })).toBe(false);
    expect(isProjectIndexable({ ...published, deletedAt: "2026-08-02T09:00:00.000Z" })).toBe(false);
  });

  it("keeps an opted-out published project available as a public showcase", () => {
    const optedOut = { ...published, searchIndexingEnabled: false };
    expect(isProjectPublicShowcase(optedOut)).toBe(true);
    expect(isProjectIndexable(optedOut)).toBe(false);
  });
});
