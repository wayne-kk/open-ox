import { existsSync, rmSync } from "fs";
import { join } from "path";
import { getSiteRoot } from "@/ai/tools/system/common";
import { buildMinimalChromeRootLayout } from "./chromeAgentCommon";
import { formatSiteFile, writeSiteFile } from "./files";
import type { PlannedProjectBlueprint } from "../types";

export interface PrepareReplicaSiteLayoutResult {
  layoutPath: string;
  removedChromeDir: boolean;
}

/**
 * Screenshot replicate: pass-through root layout only — strip any global chrome
 * left from template copy, prior scaffold runs, or checkpoint resume.
 */
export async function prepareReplicaSiteLayout(
  blueprint: PlannedProjectBlueprint
): Promise<PrepareReplicaSiteLayoutResult> {
  const siteRoot = getSiteRoot();
  const chromeDir = join(siteRoot, "components", "chrome");
  let removedChromeDir = false;
  if (existsSync(chromeDir)) {
    rmSync(chromeDir, { recursive: true, force: true });
    removedChromeDir = true;
  }

  const layoutPath = "app/layout.tsx";
  await writeSiteFile(layoutPath, buildMinimalChromeRootLayout(blueprint));
  await formatSiteFile(layoutPath);

  return { layoutPath, removedChromeDir };
}

/** @deprecated Use {@link prepareReplicaSiteLayout} */
export const applyMinimalReplicaRootLayout = prepareReplicaSiteLayout;
