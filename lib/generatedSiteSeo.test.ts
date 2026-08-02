import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyGeneratedSiteSeo, buildGeneratedSiteSeoProfile } from "./generatedSiteSeo";

const dirs: string[] = [];

async function outputDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "open-ox-seo-"));
  dirs.push(dir);
  await fs.writeFile(
    path.join(dir, "index.html"),
    '<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="old"></head><body><main>Hello</main></body></html>'
  );
  await fs.writeFile(
    path.join(dir, "about.html"),
    '<!doctype html><html lang="en"><head></head><body><main>About</main></body></html>'
  );
  await fs.writeFile(
    path.join(dir, "404.html"),
    '<!doctype html><html lang="en"><head></head><body><main>Not found</main></body></html>'
  );
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("generated site SEO output", () => {
  it("builds a profile from saved project blueprint metadata", () => {
    expect(buildGeneratedSiteSeoProfile({
      name: "Fallback name",
      userPrompt: "Fallback description",
      blueprint: {
        brief: {
          projectTitle: "Acme Studio",
          projectDescription: "Independent design studio.",
          language: "zh-CN",
        },
        site: {
          pages: [
            { slug: "home", title: "首页", description: "欢迎来到 Acme。" },
            { slug: "about", title: "关于我们", pageDesignPlan: { pageGoal: "了解团队。" } },
          ],
        },
      },
    }, { origin: "https://acme.example/", indexable: true })).toEqual({
      origin: "https://acme.example",
      indexable: true,
      title: "Acme Studio",
      description: "Independent design studio.",
      language: "zh-CN",
      pages: [
        { path: "/", title: "首页", description: "欢迎来到 Acme。" },
        { path: "/about", title: "关于我们", description: "了解团队。" },
      ],
    });
  });

  it("writes production metadata, canonical URLs, robots and sitemap", async () => {
    const dir = await outputDir();
    await applyGeneratedSiteSeo(dir, {
      origin: "https://acme.example",
      indexable: true,
      title: "Acme Studio",
      description: "Independent design studio for digital products.",
      language: "en",
      pages: [
        { path: "/", title: "Acme Studio", description: "Independent design studio for digital products." },
        { path: "/about", title: "About Acme", description: "Meet the Acme Studio team." },
      ],
    });

    const home = await fs.readFile(path.join(dir, "index.html"), "utf8");
    const about = await fs.readFile(path.join(dir, "about.html"), "utf8");
    const robots = await fs.readFile(path.join(dir, "robots.txt"), "utf8");
    const sitemap = await fs.readFile(path.join(dir, "sitemap.xml"), "utf8");
    const notFound = await fs.readFile(path.join(dir, "404.html"), "utf8");

    expect(home).toContain("https://acme.example/");
    expect(home).toContain('property="og:title" content="Acme Studio"');
    expect(home).toContain('name="robots" content="index,follow"');
    expect(home).toContain('type="application/ld+json"');
    expect(about).toContain("About Acme");
    expect(about).toContain("https://acme.example/about");
    expect(robots).toContain("Sitemap: https://acme.example/sitemap.xml");
    expect(sitemap).toContain("<loc>https://acme.example/about</loc>");
    expect(sitemap).not.toContain("https://acme.example/404");
    expect(notFound).toContain('name="robots" content="noindex,nofollow,noarchive"');
  });

  it("marks preview exports noindex and omits a sitemap", async () => {
    const dir = await outputDir();
    await applyGeneratedSiteSeo(dir, {
      origin: "https://preview.example/project-1",
      indexable: false,
      title: "Draft project",
      description: "Private Open OX preview.",
      language: "en",
      pages: [{ path: "/", title: "Draft project", description: "Private Open OX preview." }],
    });

    const home = await fs.readFile(path.join(dir, "index.html"), "utf8");
    const robots = await fs.readFile(path.join(dir, "robots.txt"), "utf8");
    expect(home).toContain('name="robots" content="noindex,nofollow,noarchive"');
    expect(robots).toContain("Disallow: /");
    await expect(fs.access(path.join(dir, "sitemap.xml"))).rejects.toThrow();
  });
});
