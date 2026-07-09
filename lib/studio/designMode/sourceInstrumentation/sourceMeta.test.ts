import { describe, expect, it } from "vitest";

import { decodeOxSourceMeta, encodeOxSourceMeta } from "./sourceMeta";

describe("ox source meta encoding", () => {
  it("round-trips source metadata through a URL-safe string", () => {
    const encoded = encodeOxSourceMeta({
      version: 1,
      file: "components/home/TestimonialsSection.tsx",
      line: 12,
      column: 7,
      tag: "h2",
      textKind: "static",
      classKind: "static",
    });

    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("+");
    expect(decodeOxSourceMeta(encoded)).toEqual({
      version: 1,
      file: "components/home/TestimonialsSection.tsx",
      line: 12,
      column: 7,
      tag: "h2",
      textKind: "static",
      classKind: "static",
    });
  });

  it("rejects malformed values", () => {
    expect(decodeOxSourceMeta("not-valid-json")).toBeNull();
  });
});
