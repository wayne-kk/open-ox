import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { decodeOxSourceMeta } from "./sourceMeta";
import { backfillOxSourceInProject } from "./backfillOxSource";

describe("backfillOxSourceInProject", () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it("writes data-ox-source into project TSX and refreshes coordinates", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-src-bf-"));
    const rel = "components/home/Hero.tsx";
    const abs = path.join(tmpDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(
      abs,
      `export function Hero() {
  return <h1 className="text-4xl">Hello</h1>;
}
`,
      "utf-8"
    );

    const result = await backfillOxSourceInProject(tmpDir);
    expect(result.filesTouched).toContain(rel);
    expect(result.nodesAdded).toBeGreaterThan(0);

    const out = await fs.readFile(abs, "utf-8");
    expect(out).toContain("data-ox-source=");
    const match = out.match(/data-ox-source="([^"]+)"/);
    const meta = decodeOxSourceMeta(match?.[1]);
    expect(meta).toMatchObject({ file: rel, tag: "h1", textKind: "static", classKind: "static" });
    expect(meta?.line).toBeGreaterThan(0);

    const second = await backfillOxSourceInProject(tmpDir);
    expect(second.nodesAdded).toBe(0);
  });
});
