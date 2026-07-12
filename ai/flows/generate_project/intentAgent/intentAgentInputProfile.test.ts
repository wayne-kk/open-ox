import { describe, expect, it } from "vitest";
import { isLikelyAssetUrl, listReferenceSiteCandidateUrls } from "./intentAgentInputProfile";

describe("intentAgentInputProfile URL helpers", () => {
  it("treats googleusercontent as asset not reference site", () => {
    const url = "https://lh3.googleusercontent.com/p/AF1QipNabc123=s1360-w1360";
    expect(isLikelyAssetUrl(url)).toBe(true);
    expect(listReferenceSiteCandidateUrls(`Photo: ${url}`)).toEqual([]);
  });

  it("keeps marketing-site URLs as reference candidates", () => {
    expect(listReferenceSiteCandidateUrls("参考 https://vercel.com 的排版")).toEqual([
      "https://vercel.com",
    ]);
  });
});
