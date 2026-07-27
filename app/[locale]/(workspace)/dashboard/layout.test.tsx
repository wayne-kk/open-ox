import { describe, expect, it } from "vitest";
import { generateMetadata } from "./layout";

describe("dashboard indexing policy", () => {
  it("prevents search engines from indexing or following private workspace pages", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "zh-CN" }),
    });
    expect(metadata).toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });
  });
});
