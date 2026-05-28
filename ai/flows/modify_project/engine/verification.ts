import { executeRunBuild } from "@/ai/tools/system/runBuildTool";
import {
  checkGeneratedTypeScriptFiles,
  isGeneratedTypeScriptPath,
} from "@/ai/flows/generate_project/shared/tsxDiagnostics";
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
 */
export async function runFinalVerification(
  profile: ModifyProfile,
  touchedFiles: string[]
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

  const build = await executeRunBuild({});
  const buildPassed = typeof build === "object" ? build.success : !String(build).includes("failed");
  const buildOutput =
    typeof build === "object"
      ? build.success
        ? (build.output ?? "build ok")
        : (build.error ?? build.output ?? "build failed")
      : String(build);

  return {
    tscPassed: true,
    buildPassed,
    buildOutput: `${tsc.output}\n---\n${buildOutput}`,
    skippedBuild: false,
  };
}
