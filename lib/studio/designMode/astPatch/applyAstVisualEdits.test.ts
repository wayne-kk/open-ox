import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import type { OxSourceMeta } from "../sourceInstrumentation/sourceMeta";
import { applyAstVisualEdits } from "./applyAstVisualEdits";

describe("applyAstVisualEdits", () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  async function writeFile(relPath: string, source: string) {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-ast-"));
    const abs = path.join(tmpDir, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, source, "utf-8");
    return { projectDir: tmpDir, abs };
  }

  const h2Source: OxSourceMeta = {
    version: 1,
    file: "components/home/TestimonialsSection.tsx",
    line: 2,
    column: 10,
    tag: "h2",
    textKind: "static",
    classKind: "static",
  };

  it("patches static JSX text at the source-mapped element", async () => {
    const { projectDir, abs } = await writeFile(
      h2Source.file,
      `export function TestimonialsSection() {
  return <h2 className="text-4xl">听听圈友们怎么说</h2>;
}`
    );

    const result = await applyAstVisualEdits(projectDir, [
      { kind: "text", source: h2Source, before: "听听圈友们怎么说", after: "听听圈友们怎么说22" },
    ]);

    expect(result.ok).toBe(true);
    expect(await fs.readFile(abs, "utf-8")).toContain("听听圈友们怎么说22");
  });

  it("patches static className utilities at the source-mapped element", async () => {
    const { projectDir, abs } = await writeFile(
      h2Source.file,
      `export function TestimonialsSection() {
  return <h2 className="text-4xl text-ink">听听圈友们怎么说</h2>;
}`
    );

    const result = await applyAstVisualEdits(projectDir, [
      {
        kind: "style",
        source: h2Source,
        property: "color",
        before: "rgb(0, 0, 0)",
        after: "#ff3366",
      },
    ]);

    expect(result.ok).toBe(true);
    expect(await fs.readFile(abs, "utf-8")).toContain("text-[#ff3366]");
  });

  it("replaces the full static className string", async () => {
    const { projectDir, abs } = await writeFile(
      h2Source.file,
      `export function TestimonialsSection() {
  return <h2 className="text-4xl text-ink">听听圈友们怎么说</h2>;
}`
    );

    const result = await applyAstVisualEdits(projectDir, [
      {
        kind: "className",
        source: h2Source,
        before: "text-4xl text-ink",
        after: "text-5xl font-bold text-[#ff3366]",
      },
    ]);

    expect(result.ok).toBe(true);
    expect(await fs.readFile(abs, "utf-8")).toContain('className="text-5xl font-bold text-[#ff3366]"');
  });

  it("rejects dynamic JSX text instead of falling back to rg", async () => {
    const dynamicSource: OxSourceMeta = {
      version: 1,
      file: "components/chrome/Navbar.tsx",
      line: 2,
      column: 10,
      tag: "a",
      textKind: "dynamic",
      classKind: "static",
    };
    const { projectDir } = await writeFile(
      dynamicSource.file,
      `export function Navbar({ label }: { label: string }) {
  return <a className="font-semibold">{label}</a>;
}`
    );

    const result = await applyAstVisualEdits(projectDir, [
      { kind: "text", source: dynamicSource, before: "热门话题", after: "热门话题1" },
    ]);

    expect(result).toEqual({
      ok: false,
      code: "DYNAMIC_TEXT_UNSUPPORTED",
      error: "This text is rendered from an expression and cannot be patched directly yet.",
    });
  });
});
