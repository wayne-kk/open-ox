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
 * Pass-through root layout for page-first / screenshot-replicate flows.
 * Strips any global chrome so page agents (or replica pages) cannot rely on
 * provisional Nav — chrome is created once after pages (unless replica owns it).
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
