import fs from "fs/promises";
import path from "path";

import { WORKSPACE_ROOT } from "@/lib/projectManager";
import { isStudioDesignModeEnabled } from "./featureFlag";

const BRIDGE_IMPORT = `import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge";`;
const TEMPLATE_BRIDGE = path.join(
  WORKSPACE_ROOT,
  "sites/template/components/open-ox/OpenOxPreviewBridge.tsx"
);

/** Copy bootstrap + patch layout so local/E2B preview iframes can load the Design Mode bridge. */
export async function ensureDesignModeBridgeInProject(projectDir: string): Promise<boolean> {
  if (!isStudioDesignModeEnabled()) return false;

  try {
    await fs.access(TEMPLATE_BRIDGE);
  } catch {
    console.warn("[designMode] Template bridge missing:", TEMPLATE_BRIDGE);
    return false;
  }

  const destBridge = path.join(projectDir, "components/open-ox/OpenOxPreviewBridge.tsx");
  await fs.mkdir(path.dirname(destBridge), { recursive: true });
  await fs.copyFile(TEMPLATE_BRIDGE, destBridge);

  const layoutPath = path.join(projectDir, "app/layout.tsx");
  let layout: string;
  try {
    layout = await fs.readFile(layoutPath, "utf-8");
  } catch {
    return false;
  }

  if (layout.includes("OpenOxPreviewBridge")) {
    return false;
  }

  const patched = patchLayoutForBridge(layout);
  await fs.writeFile(layoutPath, patched, "utf-8");
  console.log("[designMode] Patched layout with OpenOxPreviewBridge:", layoutPath);
  return true;
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
