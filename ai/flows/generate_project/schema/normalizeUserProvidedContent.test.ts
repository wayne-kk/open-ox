import { describe, expect, it } from "vitest";
import { normalizeUserProvidedContent } from "./normalizeUserProvidedContent";
import {
  extractImageUrlsFromPrompt,
  looksLikeImageUrl,
} from "@/lib/content/userProvidedContentPipeline";

describe("normalizeUserProvidedContent", () => {
  it("returns undefined for empty input", () => {
    expect(normalizeUserProvidedContent(undefined)).toBeUndefined();
    expect(normalizeUserProvidedContent({})).toBeUndefined();
  });

  it("normalizes business and testimonials", () => {
    const result = normalizeUserProvidedContent({
      business: { name: " Best Intentions ", phone: "(312) 818-1254" },
      testimonials: [{ quote: "Great bar.", author: "Alex", stars: 5 }],
      images: [{ url: "https://lh3.googleusercontent.com/photo123" }],
    });
    expect(result?.business?.name).toBe("Best Intentions");
    expect(result?.testimonials?.[0]?.quote).toBe("Great bar.");
    expect(result?.images?.[0]?.url).toContain("googleusercontent");
  });

  it("drops invalid image URLs", () => {
    const result = normalizeUserProvidedContent({
      images: [{ url: "not-a-url" }],
      menuItems: ["Burger"],
    });
    expect(result?.images).toBeUndefined();
    expect(result?.menuItems).toEqual(["Burger"]);
  });
});

describe("extractImageUrlsFromPrompt", () => {
  it("detects google user content image URLs", () => {
    const url = "https://lh3.googleusercontent.com/places/abc=s4800-w1200";
    const text = `Photos: ${url} and more text`;
    expect(looksLikeImageUrl(url)).toBe(true);
    expect(extractImageUrlsFromPrompt(text)).toEqual([url]);
  });

  it("ignores regular website URLs", () => {
    const url = "https://example.com/menu";
    expect(looksLikeImageUrl(url)).toBe(false);
    expect(extractImageUrlsFromPrompt(`Visit ${url}`)).toEqual([]);
  });
});
