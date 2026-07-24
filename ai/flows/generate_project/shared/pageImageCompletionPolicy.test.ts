import { describe, expect, it } from "vitest";
import { pageImageCompletionReason } from "./pageImageCompletionPolicy";

describe("pageImageCompletionReason", () => {
  it("requires generate_image and source replacement when a page contains an image placeholder", () => {
    const placeholderSource = `
      import Image from "next/image";
      export function Hero() {
        return <Image src="https://picsum.photos/1200/800" alt="Product" fill />;
      }
    `;

    expect(
      pageImageCompletionReason({
        sources: { "components/pages/home/Hero.tsx": placeholderSource },
        generatedPaths: [],
        assetExists: () => false,
        generationRequired: true,
      }),
    ).toContain("generate_image");

    const generatedPath = "/images/page-home-product.png";
    expect(
      pageImageCompletionReason({
        sources: {
          "components/pages/home/Hero.tsx": placeholderSource.replace(
            "https://picsum.photos/1200/800",
            generatedPath,
          ),
        },
        generatedPaths: [generatedPath],
        assetExists: () => false,
        generationRequired: true,
      }),
    ).toBeNull();
  });

  it("accepts real user URLs and existing local assets but rejects invented image paths", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `export default () => <img src="https://cdn.example.com/real.jpg" alt="Real" />`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toBeNull();

    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `export default () => <img src="/images/invented-hero.png" alt="Hero" />`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("missing image asset");
  });

  it("does not allow placeholder fallback returned by generate_image", () => {
    const fallback = "https://picsum.photos/seed/hero/1200/675";
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="${fallback}" alt="Hero" />` },
        generatedPaths: [fallback],
        assetExists: () => false,
        generationRequired: true,
      }),
    ).toContain("placeholder");
  });

  it("remembers that generation is required and requires the returned path to be consumed", () => {
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="/images/existing.png" alt="Hero" />` },
        generatedPaths: [],
        assetExists: () => true,
        generationRequired: true,
      }),
    ).toContain("Call generate_image");
  });

  it("exempts exact user-provided URLs and detects image paths stored in data", () => {
    const userUrl = "https://images.unsplash.com/photo-user-provided";
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="${userUrl}" alt="User" />` },
        generatedPaths: [],
        allowedRemoteUrls: [userUrl],
        assetExists: () => false,
      }),
    ).toBeNull();

    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `const cards = [{ image: "/images/missing-card.png" }];`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("missing image asset");
  });

  it("does not treat unrelated placeholder strings as image slots", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `const mode = "placeholder"; const route = "/api/placeholder/result.png";`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toBeNull();
  });

  it("detects placeholders in image-like variables and image arrays", () => {
    for (const source of [
      `const heroImage = "https://picsum.photos/1200/800"; export default () => <img src={heroImage} />;`,
      `const images = ["https://picsum.photos/1200/800"]; export default () => <img src={images[0]} />;`,
      `const backgroundUrl = "/images/missing-background.png";`,
      `const heroPhoto = "https://images.unsplash.com/photo-placeholder";`,
    ]) {
      expect(
        pageImageCompletionReason({
          sources: { "app/page.tsx": source },
          generatedPaths: [],
          assetExists: () => false,
        }),
      ).not.toBeNull();
    }
  });

  it("resolves one-hop image bindings even when the variable name is generic", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `const assets = ["https://picsum.photos/1200/800"]; export default () => <img src={assets[0]} />;`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("placeholder");
  });
});
