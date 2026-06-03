import { describe, expect, it } from "vitest";
import { formatUserProvidedContentAsText } from "./userProvidedContentText";

describe("formatUserProvidedContentAsText", () => {
  it("formats business and images as plain text", () => {
    const text = formatUserProvidedContentAsText({
      business: { name: "Best Intentions", address: "2457 N Milwaukee Ave" },
      images: [
        {
          url: "https://example.com/a.jpg",
          caption: "Storefront",
          path: "/images/user-storefront-1.jpg",
        },
      ],
      testimonials: [{ quote: "Great bar.", author: "Alex", stars: 5 }],
    });

    expect(text).toContain("# User-provided content");
    expect(text).toContain("Name: Best Intentions");
    expect(text).toContain("URL: https://example.com/a.jpg");
    expect(text).toContain("each URL once as remote src");
    expect(text).toContain('"Great bar."');
    expect(text).not.toContain("{");
  });
});
