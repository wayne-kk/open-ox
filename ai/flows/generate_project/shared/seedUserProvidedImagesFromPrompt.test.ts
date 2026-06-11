import { describe, expect, it } from "vitest";
import {
  extractCaptionAfterUrlOnLine,
  extractUserProvidedImagesFromPrompt,
  mergeUserProvidedImages,
  seedUserProvidedImagesFromPrompt,
  seedUserProvidedImagesFromTexts,
} from "./seedUserProvidedImagesFromPrompt";

const URL1 =
  "https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto1=s4800-w1200";
const URL2 =
  "https://lh3.googleusercontent.com/places/ANXAkqExamplePhoto2=s4800-w1200";

describe("extractUserProvidedImagesFromPrompt", () => {
  it("extracts URLs and same-line captions from Google Maps style text", () => {
    const text = `
Images:
${URL1} — main bar interior
${URL2} - patio seating
`;
    const images = extractUserProvidedImagesFromPrompt(text);
    expect(images).toHaveLength(2);
    expect(images[0]?.url).toBe(URL1);
    expect(images[0]?.caption).toBe("main bar interior");
    expect(images[1]?.caption).toBe("patio seating");
  });

  it("dedupes repeated URLs", () => {
    const text = `A ${URL1}\nB ${URL1}`;
    expect(extractUserProvidedImagesFromPrompt(text)).toHaveLength(1);
  });
});

describe("mergeUserProvidedImages", () => {
  it("merges caption from LLM onto pre-scanned URL", () => {
    const merged = mergeUserProvidedImages(
      [{ url: URL1 }],
      [{ url: URL1, caption: "hero" }]
    );
    expect(merged).toEqual([{ url: URL1, caption: "hero" }]);
  });
});

describe("seedUserProvidedImagesFromTexts", () => {
  it("merges URLs from multiple source texts", () => {
    const { images } = seedUserProvidedImagesFromTexts([], [`A ${URL1}`, `B ${URL2}`]);
    expect(images).toHaveLength(2);
  });
});

describe("seedUserProvidedImagesFromPrompt", () => {
  it("returns addedFromPromptScan count", () => {
    const { images, addedFromPromptScan } = seedUserProvidedImagesFromPrompt(
      [],
      `Photo: ${URL1}`
    );
    expect(addedFromPromptScan).toBe(1);
    expect(images[0]?.url).toBe(URL1);
  });
});

describe("extractCaptionAfterUrlOnLine", () => {
  it("parses em dash captions", () => {
    expect(extractCaptionAfterUrlOnLine(`${URL1} — cozy booth`, URL1)).toBe(
      "cozy booth"
    );
  });
});
