import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { withSiteBuildLock } from "./siteBuildLock";

describe("withSiteBuildLock", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const d of dirs.splice(0)) {
      await fs.rm(d, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("allows only one build at a time per project directory", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "site-build-lock-"));
    dirs.push(projectDir);
    let concurrent = 0;
    let maxConcurrent = 0;

    await Promise.all([
      withSiteBuildLock(projectDir, async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 80));
        concurrent -= 1;
      }),
      withSiteBuildLock(projectDir, async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        concurrent -= 1;
      }),
    ]);

    expect(maxConcurrent).toBe(1);
  });
});
