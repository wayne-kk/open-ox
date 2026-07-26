import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { applyPublicArtifactBranding } from "./publicArtifactBranding";

const tempDirs: string[] = [];

async function makeExport(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "open-ox-branding-"));
  tempDirs.push(dir);
  await fs.mkdir(path.join(dir, "about"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "index.html"),
    "<!doctype html><html><body><main>Home</main></body></html>",
  );
  await fs.writeFile(
    path.join(dir, "about", "index.html"),
    "<!doctype html><html><body><main>About</main></body></html>",
  );
  await fs.writeFile(path.join(dir, "robots.txt"), "User-agent: *");
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("public artifact branding", () => {
  it("adds one attributed, session-collapsible badge to every public HTML page", async () => {
    const outDir = await makeExport();

    await applyPublicArtifactBranding(outDir, {
      removeBranding: false,
      projectToken: "123e4567-e89b-12d3-a456-426614174000",
      appUrl: "https://open-ox.example",
      publicChannel: "vercel_deploy",
    });
    await applyPublicArtifactBranding(outDir, {
      removeBranding: false,
      projectToken: "123e4567-e89b-12d3-a456-426614174000",
      appUrl: "https://open-ox.example",
      publicChannel: "vercel_deploy",
    });

    for (const relativePath of ["index.html", "about/index.html"]) {
      const html = await fs.readFile(path.join(outDir, relativePath), "utf8");
      expect(html.match(/<div data-open-ox-branding="v1"/g)).toHaveLength(1);
      expect(html).toContain("Made with Open OX");
      expect(html).toContain("utm_source=made_with_open_ox");
      expect(html).toContain("utm_content=123e4567-e89b-12d3-a456-426614174000");
      expect(html).toContain("/api/branding/events");
      expect(html).toContain("sendBeacon");
      expect(html).toContain('data-public-channel="vercel_deploy"');
      expect(html).toContain("viewportClass");
      expect(html).not.toContain("sessionStorage");
      expect(html).not.toContain("localStorage");
      expect(html).toContain('aria-label="Collapse Made with Open OX"');
    }
    expect(await fs.readFile(path.join(outDir, "robots.txt"), "utf8")).toBe(
      "User-agent: *",
    );
  });

  it("removes an existing badge when the project has white-label entitlement", async () => {
    const outDir = await makeExport();
    await applyPublicArtifactBranding(outDir, {
      removeBranding: false,
      projectToken: "token",
      appUrl: "https://open-ox.example",
    });

    await applyPublicArtifactBranding(outDir, {
      removeBranding: true,
      projectToken: "token",
      appUrl: "https://open-ox.example",
    });

    const html = await fs.readFile(path.join(outDir, "index.html"), "utf8");
    expect(html).not.toContain("data-open-ox-branding");
    expect(html).not.toContain("Made with Open OX");
  });
});
