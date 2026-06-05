import { describe, expect, it } from "vitest";
import {
  classifyIntentAgentInputProfile,
  isLikelyAssetUrl,
  listReferenceSiteCandidateUrls,
} from "./intentAgentInputProfile";

describe("intentAgentInputProfile", () => {
  it("treats googleusercontent as asset not reference site", () => {
    const url = "https://lh3.googleusercontent.com/p/AF1QipNabc123=s1360-w1360";
    expect(isLikelyAssetUrl(url)).toBe(true);
    expect(listReferenceSiteCandidateUrls(`Photo: ${url}`)).toEqual([]);
  });

  it("classifies short bar prompt as sparse", () => {
    expect(classifyIntentAgentInputProfile("做个酒吧网站")).toBe("sparse");
  });

  it("classifies long business pack as substantive_brief", () => {
    const block = [
      "Best Intentions Chicago",
      "Address: 123 Main St",
      "Hours: Mon-Fri 5pm-2am",
      "Menu: Old Fashioned, Negroni",
      "Review: \"Great bar\" — Jane",
      "https://lh3.googleusercontent.com/a/photo1=s800",
      "https://lh3.googleusercontent.com/a/photo2=s800",
      "https://bestintentionschicago.com",
      "#1a1a1a palette",
    ].join("\n");
    const padded = block.repeat(8);
    expect(classifyIntentAgentInputProfile(padded)).toBe("substantive_brief");
  });

  it("classifies explicit reference intent with marketing URL", () => {
    const msg = "请模仿 https://vercel.com 的排版做一个 AI 工具落地页";
    expect(classifyIntentAgentInputProfile(msg)).toBe("reference_site_focus");
  });
});
