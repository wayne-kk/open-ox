import { describe, expect, it } from "vitest";
import { rewriteExportedPublicRootPathsInText } from "./staticExportPublicPathRewrite";

describe("rewriteExportedPublicRootPathsInText", () => {
  const base = "/site-previews/p%3A1";

  it("prefixes quoted /images/ paths", () => {
    const html = `<img src="/images/foo.png" alt="" /><link rel="preload" href="/images/foo.png" as="image"/>`;
    expect(rewriteExportedPublicRootPathsInText(html, base, ["images"])).toBe(
      `<img src="${base}/images/foo.png" alt="" /><link rel="preload" href="${base}/images/foo.png" as="image"/>`
    );
  });

  it("prefixes url(/images/...) in css", () => {
    const css = `a{background:url(/images/x.png)}`;
    expect(rewriteExportedPublicRootPathsInText(css, base, ["images"])).toBe(
      `a{background:url(${base}/images/x.png)}`
    );
  });

  it("handles longer segment names before shorter prefixes (sorted input)", () => {
    const text = `"/public-extra/a" '/public/x' "/public/"`;
    const got = rewriteExportedPublicRootPathsInText(text, base, ["public-extra", "public"]);
    expect(got).toBe(`"${base}/public-extra/a" '${base}/public/x' "${base}/public/"`);
  });
});
