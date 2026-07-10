import { describe, expect, it } from "vitest";

import { projectCoverDisplayUrl, stripCoverStoragePaths } from "./projectCoverUrls";

describe("projectCoverDisplayUrl", () => {
  it("appends encoded updatedAt as v", () => {
    expect(projectCoverDisplayUrl("abc", "2026-07-10T10:00:00.000Z")).toBe(
      "/api/projects/abc/cover?v=2026-07-10T10%3A00%3A00.000Z"
    );
  });

  it("omits query when updatedAt missing", () => {
    expect(projectCoverDisplayUrl("abc", null)).toBe("/api/projects/abc/cover");
    expect(projectCoverDisplayUrl("abc", "  ")).toBe("/api/projects/abc/cover");
  });
});

describe("stripCoverStoragePaths", () => {
  it("removes storage path from list items", () => {
    const out = stripCoverStoragePaths([
      {
        id: "1",
        name: "n",
        userPrompt: "p",
        status: "ready",
        createdAt: "t",
        updatedAt: "t",
        generationMode: "web",
        modificationHistory: [],
        coverImageStoragePath: ".open-ox-cover/cover.jpg",
        coverImageUpdatedAt: "2026-07-10T10:00:00.000Z",
      },
    ]);
    expect(out[0]).not.toHaveProperty("coverImageStoragePath");
    expect(out[0].coverImageUpdatedAt).toBe("2026-07-10T10:00:00.000Z");
  });
});
