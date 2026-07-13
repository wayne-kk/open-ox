import { describe, expect, it } from "vitest";
import { previewDocumentLooksPainted } from "./previewIframePainted";

function fakeDoc( partial: {
  URL?: string;
  readyState?: DocumentReadyState;
  hasBody?: boolean;
}): Document {
  return {
    documentElement: {} as HTMLElement,
    body: partial.hasBody === false ? null : ({} as HTMLBodyElement),
    URL: partial.URL ?? "http://localhost:3000/site-previews/p1",
    readyState: partial.readyState ?? "interactive",
  } as Document;
}

describe("previewDocumentLooksPainted", () => {
  it("rejects missing or about:blank documents", () => {
    expect(previewDocumentLooksPainted(null)).toBe(false);
    expect(
      previewDocumentLooksPainted(fakeDoc({ URL: "about:blank", readyState: "complete" }))
    ).toBe(false);
    expect(previewDocumentLooksPainted(fakeDoc({ hasBody: false }))).toBe(false);
  });

  it("accepts interactive documents with a real URL", () => {
    expect(
      previewDocumentLooksPainted(
        fakeDoc({
          URL: "http://localhost:3000/site-previews/p1",
          readyState: "interactive",
        })
      )
    ).toBe(true);
  });
});
