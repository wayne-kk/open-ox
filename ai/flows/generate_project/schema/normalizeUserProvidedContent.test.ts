import { describe, expect, it } from "vitest";
import { normalizeUserProvidedContent } from "./normalizeUserProvidedContent";

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
