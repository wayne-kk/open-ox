/**
 * Clear generated content in SITE_ROOT.
 * Only removes files that the generate_project flow overwrites.
 */

import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { SITE_ROOT } from "@/ai/tools/system/common";

export interface ClearTemplateResult {
  removed: string[];
  error?: string;
}

export function clearTemplate(): ClearTemplateResult {
  const removed: string[] = [];

  try {
    // 1. Section components
    const sectionsDir = join(SITE_ROOT, "components", "sections");
    if (existsSync(sectionsDir)) {
      for (const f of readdirSync(sectionsDir)) {
        if (f.endsWith(".tsx") || f.endsWith(".ts")) {
          rmSync(join(sectionsDir, f));
          removed.push(`components/sections/${f}`);
        }
      }
    }

    // 2. Single files
    for (const rel of ["app/page.tsx", "app/layout.tsx", "app/globals.css", "design-system.md"]) {
      const abs = join(SITE_ROOT, rel);
      if (existsSync(abs)) {
        rmSync(abs);
        removed.push(rel);
      }
    }

    // 3. app/[slug]/page.tsx (non-home pages)
    const appDir = join(SITE_ROOT, "app");
    if (existsSync(appDir)) {
      for (const e of readdirSync(appDir, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== "api") {
          const pagePath = join(appDir, e.name, "page.tsx");
          if (existsSync(pagePath)) {
            rmSync(pagePath);
            removed.push(`app/${e.name}/page.tsx`);
          }
          const dir = join(appDir, e.name);
          if (readdirSync(dir).length === 0) {
            rmSync(dir, { recursive: true });
          }
        }
      }
    }

    return { removed };
  } catch (err) {
    return {
      removed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
