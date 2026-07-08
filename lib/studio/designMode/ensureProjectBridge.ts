import fs from "fs/promises";
import path from "path";

import { WORKSPACE_ROOT } from "@/lib/projectManager";
import { backfillOxAnchorsInProject } from "./backfillOxAnchors";
import { isStudioDesignModeEnabled } from "./featureFlag";

const BRIDGE_IMPORT = `import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge";`;
const TEMPLATE_BRIDGE = path.join(
  WORKSPACE_ROOT,
  "sites/template/components/open-ox/OpenOxPreviewBridge.tsx"
);

export interface DesignModeProjectSetupResult {
  bridgeCopied: boolean;
  layoutPatched: boolean;
  anchorsAdded: number;
  anchorFiles: string[];
}

/** Copy bootstrap + patch layout + backfill section anchors for Design Mode. */
export async function ensureDesignModeProjectSetup(projectDir: string): Promise<DesignModeProjectSetupResult> {
  const empty: DesignModeProjectSetupResult = {
    bridgeCopied: false,
    layoutPatched: false,
    anchorsAdded: 0,
    anchorFiles: [],
  };
  if (!isStudioDesignModeEnabled()) return empty;

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

  const backfill = await backfillOxAnchorsInProject(projectDir);
  if (backfill.anchorsAdded > 0) {
    console.log(
      `[designMode] Backfilled ${backfill.anchorsAdded} data-ox-id anchor(s) in ${backfill.files.length} file(s)`
    );
  }

  return {
    bridgeCopied: true,
    layoutPatched,
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
