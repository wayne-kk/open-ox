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

  it("rejects placeholder fallback when the caller requires a generated asset", async () => {
    const images = createImageExecutor("page-home", {
      filenamePrefix: "page-home",
      requireGeneratedAsset: true,
    });

    const result = await images.executor({
      filename: "hero",
      prompt: "Editorial hero photograph, sharp focus, 4K",
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("ARK_API_KEY"),
    });
    expect(images.pendingImages).toHaveLength(0);
  });

  it("can wait for the image backend before reporting page asset success", async () => {
    process.env.ARK_API_KEY = "test-key";
    const images = createImageExecutor("page-home", {
      filenamePrefix: "page-home",
      requireGeneratedAsset: true,
      awaitCompletion: true,
      generateImage: async () => ({
        ok: true,
        path: "/images/page-home-hero.png",
        bytes: 42,
      }),
    });

    const result = await images.executor({
      filename: "hero",
      prompt: "Editorial hero photograph, sharp focus, 4K",
    });

    expect(result).toMatchObject({
      success: true,
      meta: { path: "/images/page-home-hero.png" },
    });
    expect(images.pendingImages[0]).toMatchObject({ success: true });
  });

  it("does not retain a failed awaited attempt in the delivery list", async () => {
    process.env.ARK_API_KEY = "test-key";
    let attempt = 0;
    const images = createImageExecutor("page-home", {
      filenamePrefix: "page-home",
      requireGeneratedAsset: true,
      awaitCompletion: true,
      generateImage: async () => {
        attempt += 1;
        return attempt === 1
          ? { ok: false as const, error: "temporary failure" }
          : { ok: true as const, path: "/images/page-home-hero-2.png", bytes: 42 };
      },
    });

    expect(
      await images.executor({ filename: "hero", prompt: "Editorial hero, sharp focus, 4K" }),
    ).toMatchObject({ success: false });
    expect(
      await images.executor({ filename: "hero", prompt: "Editorial hero, sharp focus, 4K" }),
    ).toMatchObject({ success: true });
    expect(images.pendingImages).toHaveLength(1);
    expect(images.pendingImages[0]).toMatchObject({ success: true });
  });
});
