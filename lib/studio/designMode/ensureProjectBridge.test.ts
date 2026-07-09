import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSourceInstrumentationInProject, patchLayoutForBridge } from "./ensureProjectBridge";

const SAMPLE_LAYOUT = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
`;

describe("patchLayoutForBridge", () => {
  it("adds import and bootstrap component", () => {
    const out = patchLayoutForBridge(SAMPLE_LAYOUT);
    expect(out).toContain('import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge"');
    expect(out).toContain("<OpenOxPreviewBridge />");
    expect(out.indexOf("OpenOxPreviewBridge")).toBeLessThan(out.indexOf("{children}"));
  });

  it("is idempotent", () => {
    const once = patchLayoutForBridge(SAMPLE_LAYOUT);
    expect(patchLayoutForBridge(once)).toBe(once);
  });
});

describe("ensureSourceInstrumentationInProject", () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it("copies loader and syncs next.config for Design Mode pick", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-instr-"));
    await fs.writeFile(
      path.join(tmpDir, "next.config.ts"),
      `export default { output: "export" };\n`,
      "utf-8"
    );

    const changed = await ensureSourceInstrumentationInProject(tmpDir);
    expect(changed).toBe(true);
    await expect(fs.access(path.join(tmpDir, "open-ox/source-instrumentation-loader.cjs"))).resolves.toBeUndefined();
    const config = await fs.readFile(path.join(tmpDir, "next.config.ts"), "utf-8");
    expect(config).toContain("source-instrumentation-loader");
  });

  it("still syncs when Direct env is off (pick + Modify still need coords)", async () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_DESIGN_MODE", "0");
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ox-instr-off-"));
    await fs.writeFile(
      path.join(tmpDir, "next.config.ts"),
      `export default { output: "export" };\n`,
      "utf-8"
    );
    const changed = await ensureSourceInstrumentationInProject(tmpDir);
    expect(changed).toBe(true);
  });
});
