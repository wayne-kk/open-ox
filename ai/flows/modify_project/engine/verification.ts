import { executeRunBuild } from "@/ai/tools/system/runBuildTool";
import {
  checkGeneratedTypeScriptFiles,
  isGeneratedTypeScriptPath,
} from "@/ai/flows/generate_project/shared/tsxDiagnostics";
import { getSiteRoot } from "@/lib/projectManager";
import { computeProjectFingerprint, ensureGlobalErrorFromTemplateForProject } from "@/lib/previewShared";
import { shouldPublishStaticSitePreview } from "@/lib/previewMode";
import {
  getStoragePreviewBasePath,
  prepareProjectDirForStaticExport,
} from "@/lib/staticSitePreview";
import { writeStaticPreviewBuildStamp } from "@/lib/staticPreviewBuildStamp";
import type { ModifyProfile } from "../profile/modifyProfile";

export type FinalVerificationResult = {
  tscPassed: boolean;
  buildPassed: boolean;
  buildOutput: string;
  skippedBuild: boolean;
};

export async function runScopedTypecheck(touchedFiles: string[]): Promise<{
  passed: boolean;
  output: string;
}> {
  const tsPaths = [...new Set(touchedFiles.filter(isGeneratedTypeScriptPath))];
  if (tsPaths.length === 0) {
    return { passed: true, output: "No TS/TSX files touched — scoped typecheck skipped." };
  }
  const result = await checkGeneratedTypeScriptFiles(tsPaths);
  if (result.passed) {
    return { passed: true, output: `Scoped typecheck passed (${result.fileCount} file(s)).` };
  }
  return {
    passed: false,
    output: result.tscStyleLog || `Scoped typecheck failed (${result.errorCount} error(s)).`,
  };
}

/**
 * End-of-flow verification: scoped tsc first; full `pnpm build` only when scope requires it or tsc fails on structural files.
 *
 * When Storage static preview is enabled, builds with `OPEN_OX_STATIC_BASE_PATH` and stamps `out/`
 * so `syncStaticSitePreview` can upload without a second webpack build.
 */
export async function runFinalVerification(
  profile: ModifyProfile,
  touchedFiles: string[],
  options?: { projectId?: string }
): Promise<FinalVerificationResult> {
  const unique = [...new Set(touchedFiles.map((f) => f.replace(/\\/g, "/")))];

  if (unique.length === 0) {
    return {
      tscPassed: true,
      buildPassed: true,
      buildOutput: "No files modified.",
      skippedBuild: true,
    };
  }

  const tsc = await runScopedTypecheck(unique);
  if (!tsc.passed) {
    return {
      tscPassed: false,
      buildPassed: false,
      buildOutput: tsc.output,
      skippedBuild: true,
    };
  }

  const skipBuild =
    profile.verificationMode === "tsc_only" || profile.verificationMode === "none";

  if (skipBuild) {
    return {
      tscPassed: true,
      buildPassed: true,
      buildOutput: `${tsc.output}\nProduction build skipped (intent router profile: ${profile.verificationMode}).`,
      skippedBuild: true,
    };
  }

  const projectId = options?.projectId?.trim() || "";
  const useStaticPreviewBuild = Boolean(projectId) && shouldPublishStaticSitePreview();
  let staticBasePath = "";

  if (useStaticPreviewBuild) {
    await ensureGlobalErrorFromTemplateForProject(projectId);
    const projectDir = getSiteRoot(projectId);
    await prepareProjectDirForStaticExport(projectDir);
    staticBasePath = getStoragePreviewBasePath(projectId);
  }

  const build = await executeRunBuild(
    staticBasePath ? { openOxStaticBasePath: staticBasePath } : {}
  );
  const buildPassed = typeof build === "object" ? build.success : !String(build).includes("failed");
  const buildOutput =
    typeof build === "object"
      ? build.success
        ? (build.output ?? "build ok")
        : (build.error ?? build.output ?? "build failed")
      : String(build);

  if (buildPassed && useStaticPreviewBuild && staticBasePath) {
    try {
      const projectDir = getSiteRoot(projectId);
      const filesFingerprint = await computeProjectFingerprint(projectId);
      await writeStaticPreviewBuildStamp(projectDir, {
        filesFingerprint,
        basePath: staticBasePath,
        builtAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[modify] writeStaticPreviewBuildStamp failed:", err);
    }
  }

  return {
    tscPassed: true,
    buildPassed,
    buildOutput: `${tsc.output}\n---\n${buildOutput}`,
    skippedBuild: false,
  };
}
