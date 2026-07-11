import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { stripOxSourceAttrsFromSource, stripOxSourceFromProject } from "./stripOxSource";

describe("stripOxSourceAttrsFromSource", () => {
  it("removes condensed ox attrs without touching className or text", () => {
    const input = `export function Hero() {
  return (
    <div data-ox-source="abc" data-ox-text-kind="dynamic" data-ox-class-kind="static" className="lg:col-span-5 space-y-10">
      <span data-ox-source="def" data-ox-text-kind="static" data-ox-class-kind="static" className="font-serif">
        Visit Us
      </span>
    </div>
  );
}
`;
    const { code, attrsRemoved } = stripOxSourceAttrsFromSource(input);
    expect(attrsRemoved).toBe(6);
    expect(code).not.toContain("data-ox-");
    expect(code).toContain('className="lg:col-span-5 space-y-10"');
    expect(code).toContain("Visit Us");
    expect(code).toContain('<div className="lg:col-span-5 space-y-10">');
  });

  it("removes multiline ox attrs without reformatting siblings", () => {
    const input = `    <div
      data-ox-source="eyJ2ZXJzaW9uIjoxfQ"
      data-ox-text-kind="dynamic"
      data-ox-class-kind="static"
      className="mx-auto"
    >
`;
    const { code, attrsRemoved } = stripOxSourceAttrsFromSource(input);
    expect(attrsRemoved).toBe(3);
    expect(code).toBe(`    <div
      className="mx-auto"
    >
`);
  });
});

describe("stripOxSourceFromProject", () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it("strips persisted data-ox-source from project TSX and is idempotent", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-src-strip-"));
    const rel = "components/home/Hero.tsx";
    const abs = path.join(tmpDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(
      abs,
      `export function Hero() {
  return <h1 data-ox-source="x" data-ox-text-kind="static" data-ox-class-kind="static" className="text-4xl">Hello</h1>;
}
`,
      "utf-8"
    );

    const result = await stripOxSourceFromProject(tmpDir);
    expect(result.filesTouched).toContain(rel);
    expect(result.attrsRemoved).toBe(3);

    const out = await fs.readFile(abs, "utf-8");
    expect(out).not.toContain("data-ox-");
    expect(out).toContain('className="text-4xl"');
    expect(out).toContain("Hello");

    const second = await stripOxSourceFromProject(tmpDir);
    expect(second.attrsRemoved).toBe(0);
    expect(second.filesTouched).toEqual([]);
  });
});
