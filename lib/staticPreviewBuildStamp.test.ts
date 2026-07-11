import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  canReuseStaticExportOut,
  writeStaticPreviewBuildStamp,
} from "./staticPreviewBuildStamp";

describe("canReuseStaticExportOut", () => {
  it("returns true only when stamp + out/index.html match", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-stamp-"));
    try {
      expect(await canReuseStaticExportOut(dir, "fp1", "/site-previews/p")).toBe(false);

      await writeStaticPreviewBuildStamp(dir, {
        filesFingerprint: "fp1",
        basePath: "/site-previews/p",
        builtAt: new Date().toISOString(),
      });
      expect(await canReuseStaticExportOut(dir, "fp1", "/site-previews/p")).toBe(false);

      await fs.mkdir(path.join(dir, "out"), { recursive: true });
      await fs.writeFile(path.join(dir, "out", "index.html"), "<html></html>\n");
      expect(await canReuseStaticExportOut(dir, "fp1", "/site-previews/p")).toBe(true);
      expect(await canReuseStaticExportOut(dir, "fp2", "/site-previews/p")).toBe(false);
      expect(await canReuseStaticExportOut(dir, "fp1", "/other")).toBe(false);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
