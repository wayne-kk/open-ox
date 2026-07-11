import fs from "fs/promises";
import path from "path";

import { WORKSPACE_ROOT } from "@/lib/projectManager";
import { backfillOxAnchorsInProject } from "./backfillOxAnchors";
import { stripOxSourceFromProject } from "./sourceInstrumentation/stripOxSource";

const BRIDGE_IMPORT = `import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge";`;
const TEMPLATE_BRIDGE = path.join(
  WORKSPACE_ROOT,
  "sites/template/components/open-ox/OpenOxPreviewBridge.tsx"
);
const TEMPLATE_LOADER = path.join(
  WORKSPACE_ROOT,
  "sites/template/open-ox/source-instrumentation-loader.cjs"
);
const TEMPLATE_NEXT_CONFIG = path.join(WORKSPACE_ROOT, "sites/template/next.config.ts");

export interface DesignModeProjectSetupResult {
  bridgeCopied: boolean;
  layoutPatched: boolean;
  instrumentationSynced: boolean;
  /** True when previously persisted data-ox-source attrs were stripped from disk. */
  sourceAttrsStripped: boolean;
  anchorsAdded: number;
  anchorFiles: string[];
}

/**
 * Ensure generated sites have the webpack source-instrumentation loader + next.config rule.
 * Without this, `data-ox-source` is never injected (most generated sites predate the rule).
 */
export async function ensureSourceInstrumentationInProject(projectDir: string): Promise<boolean> {
  // Always sync when preparing local preview — pick + Modify need source coords.
  let changed = false;

  try {
    await fs.access(TEMPLATE_LOADER);
  } catch {
    console.warn("[designMode] Template instrumentation loader missing:", TEMPLATE_LOADER);
    return false;
  }

  const destLoader = path.join(projectDir, "open-ox/source-instrumentation-loader.cjs");
  await fs.mkdir(path.dirname(destLoader), { recursive: true });
  await fs.copyFile(TEMPLATE_LOADER, destLoader);

  const destConfig = path.join(projectDir, "next.config.ts");
  let existing = "";
  try {
    existing = await fs.readFile(destConfig, "utf-8");
  } catch {
    existing = "";
  }

  if (!existing.includes("source-instrumentation-loader")) {
    try {
      await fs.access(TEMPLATE_NEXT_CONFIG);
      await fs.copyFile(TEMPLATE_NEXT_CONFIG, destConfig);
      changed = true;
      console.log(
        "[designMode] Synced next.config.ts from template (source-instrumentation webpack rule). " +
          "Custom next.config.ts was replaced — merge from git if you had local edits."
      );
    } catch (err) {
      console.warn("[designMode] Could not sync next.config.ts from template:", err);
    }
  }

  return changed;
}

/** Copy bootstrap + patch layout + sync instrumentation + backfill section anchors for Design Mode. */
export async function ensureDesignModeProjectSetup(projectDir: string): Promise<DesignModeProjectSetupResult> {
  const empty: DesignModeProjectSetupResult = {
    bridgeCopied: false,
    layoutPatched: false,
    instrumentationSynced: false,
    sourceAttrsStripped: false,
    anchorsAdded: 0,
    anchorFiles: [],
  };
  try {
    await fs.access(TEMPLATE_BRIDGE);
  } catch {
    console.warn("[designMode] Template bridge missing:", TEMPLATE_BRIDGE);
    return empty;
  }

  const destBridge = path.join(projectDir, "components/open-ox/OpenOxPreviewBridge.tsx");
  await fs.mkdir(path.dirname(destBridge), { recursive: true });
  await fs.copyFile(TEMPLATE_BRIDGE, destBridge);

  let layoutPatched = false;
  const layoutPath = path.join(projectDir, "app/layout.tsx");
  try {
    const layout = await fs.readFile(layoutPath, "utf-8");
    if (!layout.includes("OpenOxPreviewBridge")) {
      await fs.writeFile(layoutPath, patchLayoutForBridge(layout), "utf-8");
      layoutPatched = true;
      console.log("[designMode] Patched layout with OpenOxPreviewBridge:", layoutPath);
    }
  } catch {
    /* no layout */
  }

  // Sync webpack loader + next.config so `next dev --webpack` can inject data-ox-source at compile time.
  const instrumentationSynced = await ensureSourceInstrumentationInProject(projectDir);

  // Clean up any leftover disk backfill from older Turbopack workaround builds.
  const sourceStrip = await stripOxSourceFromProject(projectDir);
  const sourceAttrsStripped = sourceStrip.attrsRemoved > 0 || sourceStrip.filesTouched.length > 0;
  if (sourceAttrsStripped) {
    console.log(
      `[designMode] Stripped persisted data-ox-source from ${sourceStrip.filesTouched.length} file(s) (${sourceStrip.attrsRemoved} attr(s))`
    );
  }

  const backfill = await backfillOxAnchorsInProject(projectDir);
  if (backfill.anchorsAdded > 0) {
    console.log(
      `[designMode] Backfilled ${backfill.anchorsAdded} data-ox-id anchor(s) in ${backfill.files.length} file(s)`
    );
  }

  return {
    bridgeCopied: true,
    layoutPatched,
    instrumentationSynced,
    sourceAttrsStripped,
    anchorsAdded: backfill.anchorsAdded,
    anchorFiles: backfill.files,
  };
}

/** @deprecated Use ensureDesignModeProjectSetup — kept for call-site compatibility. */
export async function ensureDesignModeBridgeInProject(projectDir: string): Promise<boolean> {
  const result = await ensureDesignModeProjectSetup(projectDir);
  return result.layoutPatched;
}

/** Pure helper for tests — inserts import + client bootstrap into root layout. */
export function patchLayoutForBridge(layout: string): string {
  if (layout.includes("OpenOxPreviewBridge")) return layout;

  let next = layout;
  if (!next.includes(BRIDGE_IMPORT)) {
    const imports = [...next.matchAll(/^import .+;\n/gm)];
    if (imports.length > 0) {
      const last = imports[imports.length - 1]![0];
      next = next.replace(last, `${last}${BRIDGE_IMPORT}\n`);
    } else {
      next = `${BRIDGE_IMPORT}\n${next}`;
    }
  }

  if (!next.includes("<OpenOxPreviewBridge")) {
    next = next.replace(/(<body[^>]*>)/, `$1\n        <OpenOxPreviewBridge />`);
  }

  return next;
}
