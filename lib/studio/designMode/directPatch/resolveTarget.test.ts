import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { findLineToPatch, patchTextInAnchorScope, resolveVisualEditTargetFile } from "./resolveTarget";

const FIXTURE = `<section data-ox-id="hero-root" className="py-20">
  <h1
    data-ox-id="hero-headline"
    className="text-4xl text-white"
  >
    独立出版
  </h1>
</section>`;

describe("resolveTarget M2 anchors", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeProject(content: string) {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-m2-"));
    const rel = "components/sections/Hero.tsx";
    const abs = path.join(tmpDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
    return rel;
  }

  it("resolves file by data-ox-id", async () => {
    await writeProject(FIXTURE);
    const result = await resolveVisualEditTargetFile(tmpDir, {
      kind: "text",
      oxId: "hero-headline",
      selectorHint: "h1",
      elementLabel: "h1",
      before: "独立出版",
      after: "自助出版",
    });
    expect(result).toEqual({ file: "components/sections/Hero.tsx" });
  });

  it("finds anchor-scoped text line", async () => {
    const rel = await writeProject(FIXTURE);
    const abs = path.join(tmpDir, rel);
    const line = await findLineToPatch(abs, {
      kind: "text",
      oxId: "hero-headline",
      selectorHint: "h1",
      elementLabel: "h1",
      before: "独立出版",
      after: "自助出版",
    });
    expect("lineIndex" in line && line.line.includes("独立出版")).toBe(true);
  });

  it("patchTextInAnchorScope replaces only within anchor element", async () => {
    const rel = await writeProject(FIXTURE + "\n<p>独立出版</p>");
    const abs = path.join(tmpDir, rel);
    const patched = await patchTextInAnchorScope(abs, {
      kind: "text",
      oxId: "hero-headline",
      selectorHint: "h1",
      elementLabel: "h1",
      before: "独立出版",
      after: "自助出版",
    });
    expect("content" in patched).toBe(true);
    if ("content" in patched) {
      expect(patched.content).toContain("自助出版");
      expect(patched.content.match(/独立出版/g)?.length).toBe(1);
    }
  });
});
