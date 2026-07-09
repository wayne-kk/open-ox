import { describe, expect, it } from "vitest";

import { decodeOxSourceMeta } from "./sourceMeta";
import { instrumentTsxSource } from "./instrumentTsx";

function firstSourceMeta(output: string) {
  const match = output.match(/data-ox-source="([^"]+)"/);
  if (!match?.[1]) throw new Error("missing data-ox-source");
  return decodeOxSourceMeta(match[1]);
}

describe("instrumentTsxSource", () => {
  it("adds source metadata to static JSX elements", () => {
    const out = instrumentTsxSource({
      filePath: "components/home/TestimonialsSection.tsx",
      source: `export function TestimonialsSection() {
  return <h2 className="text-4xl">听听圈友们怎么说</h2>;
}`,
    });

    expect(out.code).toContain("data-ox-source=");
    expect(out.code).toContain('data-ox-text-kind="static"');
    expect(out.code).toContain('data-ox-class-kind="static"');
    expect(firstSourceMeta(out.code)).toMatchObject({
      file: "components/home/TestimonialsSection.tsx",
      tag: "h2",
      textKind: "static",
      classKind: "static",
    });
  });

  it("marks expression-rendered text as dynamic", () => {
    const out = instrumentTsxSource({
      filePath: "components/chrome/Navbar.tsx",
      source: `export function Navbar({ label }: { label: string }) {
  return <a className="font-semibold">{label}</a>;
}`,
    });

    expect(out.code).toContain('data-ox-text-kind="dynamic"');
    expect(firstSourceMeta(out.code)).toMatchObject({
      file: "components/chrome/Navbar.tsx",
      tag: "a",
      textKind: "dynamic",
      classKind: "static",
    });
  });
});
