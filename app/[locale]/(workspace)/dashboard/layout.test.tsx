import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("dashboard indexing policy", () => {
  it("prevents search engines from indexing or following private workspace pages", () => {
    expect(metadata).toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });
  });
});
