/**
 * Clear generated content in `sites/template/`.
 *
 * This is the developer-facing dev-tool used by `/api/clear-template`. It is
 * deliberately decoupled from the per-request site-root context (which now
 * refuses to point at `sites/template/`). The flow is:
 *   - Operate strictly on `WORKSPACE_ROOT/sites/template/`.
 *   - Only remove files that the generate flow is allowed to overwrite.
 */

import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { WORKSPACE_ROOT } from "@/ai/tools/system/common";

function runtimeJoin(...segments: string[]): string {
  return join(...segments);
}

const TEMPLATE_ROOT = runtimeJoin(WORKSPACE_ROOT, "sites", "template");

export interface ClearTemplateResult {
  removed: string[];
  error?: string;
}

export function clearTemplate(): ClearTemplateResult {
  const removed: string[] = [];

  try {
    const sectionsDir = runtimeJoin(TEMPLATE_ROOT, "components", "sections");
    if (existsSync(sectionsDir)) {
      for (const f of readdirSync(sectionsDir)) {
        if (f.endsWith(".tsx") || f.endsWith(".ts")) {
          rmSync(runtimeJoin(sectionsDir, f));
          removed.push(`components/sections/${f}`);
        }
      }
    }

    for (const rel of ["app/page.tsx", "app/layout.tsx", "app/globals.css", "design-system.md"]) {
      const abs = runtimeJoin(TEMPLATE_ROOT, rel);
      if (existsSync(abs)) {
        rmSync(abs);
        removed.push(rel);
      }
    }

    const imagesDir = runtimeJoin(TEMPLATE_ROOT, "public", "images");
    if (existsSync(imagesDir)) {
      for (const f of readdirSync(imagesDir)) {
        if (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".webp")) {
          rmSync(runtimeJoin(imagesDir, f));
          removed.push(`public/images/${f}`);
        }
      }
    }

    const appDir = runtimeJoin(TEMPLATE_ROOT, "app");
    if (existsSync(appDir)) {
      for (const e of readdirSync(appDir, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== "api") {
          const pagePath = runtimeJoin(appDir, e.name, "page.tsx");
          if (existsSync(pagePath)) {
            rmSync(pagePath);
            removed.push(`app/${e.name}/page.tsx`);
          }
          const dir = runtimeJoin(appDir, e.name);
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
