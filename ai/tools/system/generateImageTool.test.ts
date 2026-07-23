import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createImageExecutor } from "./generateImageTool";

describe("createImageExecutor", () => {
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.ARK_API_KEY;
    delete process.env.ARK_API_KEY;
  });

  afterEach(() => {
    if (previousApiKey === undefined) {
      delete process.env.ARK_API_KEY;
    } else {
      process.env.ARK_API_KEY = previousApiKey;
    }
  });

  it("namespaces identical filenames from concurrent page workers", async () => {
    const home = createImageExecutor("page-home", { filenamePrefix: "page-home" });
    const about = createImageExecutor("page-about", { filenamePrefix: "page-about" });

    const [homeResult, aboutResult] = await Promise.all([
      home.executor({ filename: "hero", prompt: "Home hero, sharp focus, 4K" }),
      about.executor({ filename: "hero", prompt: "About hero, sharp focus, 4K" }),
    ]);

    expect(homeResult).toMatchObject({
      success: true,
      meta: { filename: "page-home-hero" },
    });
    expect(aboutResult).toMatchObject({
      success: true,
      meta: { filename: "page-about-hero" },
    });
  });

  it("deduplicates long repeated filenames without truncation loops", async () => {
    const images = createImageExecutor("page-home", { filenamePrefix: "page-home" });
    const filename = "x".repeat(100);

    const first = await images.executor({ filename, prompt: "First image, sharp focus, 4K" });
    const second = await images.executor({ filename, prompt: "Second image, sharp focus, 4K" });

    expect(first).toMatchObject({ success: true });
    expect(second).toMatchObject({ success: true });
    expect((first as { meta?: { filename?: string } }).meta?.filename).not.toBe(
      (second as { meta?: { filename?: string } }).meta?.filename
    );
  });

  it("preserves uniqueness when page scopes share a long prefix", async () => {
    const sharedPrefix = `page-${"nested-route-".repeat(8)}`;
    expect(sharedPrefix.length).toBeGreaterThan(80);
    const firstPage = createImageExecutor(`${sharedPrefix}alpha`, {
      filenamePrefix: `${sharedPrefix}alpha`,
    });
    const secondPage = createImageExecutor(`${sharedPrefix}beta`, {
      filenamePrefix: `${sharedPrefix}beta`,
    });

    const [first, second] = await Promise.all([
      firstPage.executor({ filename: "hero", prompt: "First hero, sharp focus, 4K" }),
      secondPage.executor({ filename: "hero", prompt: "Second hero, sharp focus, 4K" }),
    ]);

    expect((first as { meta?: { filename?: string } }).meta?.filename).not.toBe(
      (second as { meta?: { filename?: string } }).meta?.filename
    );
  });
});
