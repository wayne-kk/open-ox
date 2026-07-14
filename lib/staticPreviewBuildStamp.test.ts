import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  canReuseStaticExportOut,
  clearStaticPreviewBuildStamp,
  isStaticPreviewOutAssetMissingError,
  readStaticPreviewBuildStamp,
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

describe("clearStaticPreviewBuildStamp", () => {
  it("removes the stamp so out/ cannot be reused", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-stamp-clear-"));
    try {
      await writeStaticPreviewBuildStamp(dir, {
        filesFingerprint: "fp1",
        basePath: "/site-previews/p",
        builtAt: "2026-07-14T00:00:00.000Z",
      });
      expect(await readStaticPreviewBuildStamp(dir)).not.toBeNull();
      await clearStaticPreviewBuildStamp(dir);
      expect(await readStaticPreviewBuildStamp(dir)).toBeNull();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("isStaticPreviewOutAssetMissingError", () => {
  it("detects tagged missing-asset errors and ENOENT under out/", () => {
    expect(
      isStaticPreviewOutAssetMissingError(
        new Error("STATIC_PREVIEW_OUT_MISSING:_next/static/media/foo.woff2")
      )
    ).toBe(true);
    const enoent = Object.assign(
      new Error(
        "ENOENT: no such file or directory, open '/sharedata/wayne/open-ox/sites/x/out/_next/static/media/a.woff2'"
      ),
      { code: "ENOENT" }
    );
    expect(isStaticPreviewOutAssetMissingError(enoent)).toBe(true);
    expect(isStaticPreviewOutAssetMissingError(new Error("upload failed"))).toBe(false);
  });
});
