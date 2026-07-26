import { describe, expect, it } from "vitest";
import { pageImageArtifactRequirements, pageImageCompletionReason } from "./pageImageCompletionPolicy";

describe("pageImageCompletionReason", () => {
  it("changes a placeholder requirement from asset generation to source editing", () => {
    const options = {
      sources: { "app/page.tsx": `<img src="https://picsum.photos/hero" />` },
      assetExists: () => false,
    };
    expect(pageImageArtifactRequirements({ ...options, generatedPaths: [] })).toEqual([
      expect.objectContaining({
        kind: "asset_reference",
        path: "app/page.tsx",
        nextAction: "generate_asset",
      }),
    ]);
    expect(pageImageArtifactRequirements({
      ...options,
      generatedPaths: ["/images/page-home-hero.png"],
    })).toEqual([
      expect.objectContaining({
        kind: "asset_reference",
        path: "app/page.tsx",
        nextAction: "edit_source",
      }),
    ]);
  });

  it("consumes generated assets one requirement at a time", () => {
    const requirements = pageImageArtifactRequirements({
      sources: {
        "app/page.tsx": `<><img src="https://picsum.photos/one" /><img src="https://picsum.photos/two" /></>`,
      },
      generatedPaths: ["/images/one.png"],
      assetExists: () => false,
    });
    expect(requirements.map((requirement) =>
      requirement.kind === "asset_reference" ? requirement.nextAction : requirement.kind
    )).toEqual(["edit_source", "generate_asset"]);
  });
  it("requires generate_image and a local edit when a page contains an image placeholder", () => {
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
      }),
    ).toBeNull();
  });

  it("keeps a missing declared local path in generation state without source editing", () => {
    const requirement = pageImageArtifactRequirements({
      sources: { "app/page.tsx": `<img src="/images/home-hero.png" alt="Hero" />` },
      generatedPaths: ["/images/unrelated.png"],
      assetExists: () => false,
    })[0];

    expect(requirement).toEqual({
      kind: "asset_reference",
      path: "app/page.tsx",
      reference: "/images/home-hero.png",
      nextAction: "generate_asset",
    });
  });

  it("accepts a generated asset already referenced at its declared local path", () => {
    expect(pageImageArtifactRequirements({
      sources: { "app/page.tsx": `<img src="/images/creator-avatar-1.png" alt="Creator" />` },
      generatedPaths: ["/images/creator-avatar-1.png"],
      assetExists: () => false,
    })).toEqual([]);
  });

  it("does not turn an unused generated asset into a self-replacement edit", () => {
    expect(pageImageArtifactRequirements({
      sources: { "app/page.tsx": "export default () => <main>Ready</main>" },
      generatedPaths: ["/images/unused.png"],
      assetExists: () => false,
    })).toEqual([]);
  });

  it("accepts exact user URLs and existing local assets but rejects other remote or invented paths", () => {
    const userUrl = "https://cdn.example.com/user-provided.jpg";
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `export default () => <img src="${userUrl}" alt="Real" />`,
        },
        generatedPaths: [],
        allowedRemoteUrls: [userUrl],
        assetExists: () => false,
      }),
    ).toBeNull();

    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `export default () => <img src="https://cdn.example.com/arbitrary.jpg" />`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("not a user-provided URL");

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
      }),
    ).toContain("placeholder");
  });

  it("does not retain an obsolete placeholder obligation after the source revision changes", () => {
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="/images/existing.png" alt="Hero" />` },
        generatedPaths: [],
        assetExists: () => true,
      }),
    ).toBeNull();
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

  it("resolves nested image fields through static map callback bindings", () => {
    const source = `
      const items = [
        { product: { image: "/images/product-one.png" } },
        { product: { image: "/images/product-two.png" } },
      ];
      export default () => items.map((item) => <img src={item.product.image} />);
    `;
    expect(pageImageCompletionReason({
      sources: { "app/page.tsx": source },
      generatedPaths: ["/images/product-one.png", "/images/product-two.png"],
      assetExists: () => false,
    })).toBeNull();
  });

  it("still rejects placeholders resolved through nested map callback bindings", () => {
    const source = `
      const items = [{ product: { image: "https://picsum.photos/product" } }];
      export default () => items.map((item) => <img src={item.product.image} />);
    `;
    expect(pageImageCompletionReason({
      sources: { "app/page.tsx": source },
      generatedPaths: [],
      assetExists: () => false,
    })).toContain("placeholder");
  });

  it("allows runtime-only nested image bindings without inventing a source edit", () => {
    const source = `export default ({ item }) => <img src={item.product.image} />;`;
    expect(pageImageCompletionReason({
      sources: { "app/page.tsx": source },
      generatedPaths: [],
      assetExists: () => false,
    })).toBeNull();
  });

  it("does not require an unused generated alternative to be referenced", () => {
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="/images/first.png" alt="Hero" />` },
        generatedPaths: ["/images/first.png", "/images/unused.png"],
        assetExists: () => false,
      }),
    ).toBeNull();
  });

  it("does not make generated asset bookkeeping a page completion requirement", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `const heroImage = "/images/generated.png"; export default () => <main />;`,
        },
        generatedPaths: ["/images/generated.png"],
        assetExists: () => false,
      }),
    ).toBeNull();
  });

  it("counts inline style and stylesheet URLs as real image sinks", () => {
    for (const sources of [
      {
        "app/page.tsx": `export default () => <div style={{ backgroundImage: "url(/images/generated.png)" }} />;`,
      },
      {
        "app/page.tsx": `import styles from "./page.module.css"; export default () => <div className={styles.hero} />;`,
        "app/page.module.css": `.hero { background-image: url(/images/generated.png); }`,
      },
    ]) {
      expect(
        pageImageCompletionReason({
          sources,
          generatedPaths: ["/images/generated.png"],
          assetExists: () => false,
        }),
      ).toBeNull();
    }
  });

  it("detects placeholders and missing assets in scoped CSS-bearing syntax", () => {
    for (const sources of [
      { "app/page.module.css": `.hero { background: url(https://picsum.photos/hero); }` },
      { "app/page.tsx": `export default () => <div className="bg-[url('/images/missing.png')]" />;` },
      {
        "app/page.tsx": "export default () => <style jsx>{`.hero { background: url(https://picsum.photos/hero); }`}</style>;",
      },
    ]) {
      expect(
        pageImageCompletionReason({
          sources,
          generatedPaths: [],
          assetExists: () => false,
        }),
      ).not.toBeNull();
    }
  });

  it("allows non-image CSS interpolation but rejects dynamic image CSS", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": "const Box = styled.div`color: ${p => p.color};`; export default () => <Box />;",
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toBeNull();

    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": "export default () => <div className={`bg-[url(${heroUrl})]`} />;",
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("cannot be verified statically");
  });

  it("extracts static image-set candidates as image sinks", () => {
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.module.css": `.hero { background-image: image-set("https://picsum.photos/hero" 1x); }`,
        },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("placeholder");

    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.module.css": `.hero { background-image: image-set("/images/generated.png" 1x); }`,
        },
        generatedPaths: ["/images/generated.png"],
        assetExists: () => false,
      }),
    ).toBeNull();
  });

  it("rejects protocol-relative remote image URLs", () => {
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="//cdn.example.com/arbitrary.jpg" />` },
        generatedPaths: [],
        assetExists: () => false,
      }),
    ).toContain("not a user-provided URL");
  });

  it("matches placeholder URL hostnames exactly and ignores comments", () => {
    const allowedUrl = "https://cdn.example.com/assets/picsum.photos-cover.jpg";
    expect(
      pageImageCompletionReason({
        sources: {
          "app/page.tsx": `
            // background-image: url(https://picsum.photos/comment-only)
            export default () => <img src="${allowedUrl}" />;
          `,
        },
        generatedPaths: [],
        allowedRemoteUrls: [allowedUrl],
        assetExists: () => false,
      }),
    ).toBeNull();
  });

  it("detects responsive and template-string placeholders", () => {
    for (const source of [
      `export default () => <img srcSet="https://picsum.photos/400 1x, https://picsum.photos/800 2x" />;`,
      "const id = 10; export default () => <img src={`https://picsum.photos/${id}/800`} />;",
    ]) {
      expect(
        pageImageCompletionReason({
          sources: { "app/page.tsx": source },
          generatedPaths: [],
          assetExists: () => false,
        }),
      ).toContain("placeholder");
    }
  });

  it("resolves shadowed image variables in their lexical scope", () => {
    const source = `
      function Placeholder() {
        const heroImage = "https://picsum.photos/1200/800";
        return <img src={heroImage} />;
      }
      function Ready() {
        const heroImage = "/images/ready.png";
        return <img src={heroImage} />;
      }
    `;
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": source },
        generatedPaths: ["/images/ready.png"],
        assetExists: () => false,
      }),
    ).toContain("placeholder");
  });

  it("rejects local image paths that escape the public images directory", () => {
    expect(
      pageImageCompletionReason({
        sources: { "app/page.tsx": `<img src="/images/../../../tmp/existing.png" />` },
        generatedPaths: [],
        assetExists: () => true,
      }),
    ).toContain("invalid image asset path");
  });

  it("checks every local images path, including SVG and extensionless assets", () => {
    for (const path of ["/images/brand.svg", "/images/avatar"]) {
      expect(
        pageImageCompletionReason({
          sources: { "app/page.tsx": `<img src="${path}" />` },
          generatedPaths: [],
          assetExists: () => false,
        }),
      ).toContain("missing image asset");
    }
  });

  it("allows ordinary runtime image bindings", () => {
    for (const source of [
      `import { HERO } from "./assets"; export default () => <img src={HERO} />;`,
      `const config = getConfig(); export default () => <img src={config.image} />;`,
    ]) {
      expect(pageImageCompletionReason({
        sources: { "app/page.tsx": source },
        generatedPaths: [],
        assetExists: () => false,
      })).toBeNull();
    }
  });

  it("rejects computed image expressions that cannot be verified statically", () => {
    for (const source of [
      `const getHero = () => "https://picsum.photos/1200/800"; export default () => <img src={getHero()} />;`,
      "const slug = 'hero'; export default () => <img src={`/images/${slug}.png`} />;",
    ]) {
      expect(
        pageImageCompletionReason({
          sources: { "app/page.tsx": source },
          generatedPaths: [],
          assetExists: () => false,
        }),
      ).toContain("cannot be verified statically");
    }
  });
});
