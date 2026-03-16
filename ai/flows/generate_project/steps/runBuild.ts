import { executeSystemTool } from "../../../tools";
import type { BuildVerificationResult } from "../types";

export async function stepRunBuild(): Promise<BuildVerificationResult> {
  const buildResult = await executeSystemTool("run_build", { script: "build" });
  const output =
    typeof buildResult === "string"
      ? buildResult
      : buildResult.success
        ? buildResult.output ?? "build passed"
        : buildResult.error ?? "build failed";

  return {
    success: typeof buildResult === "object" ? buildResult.success : true,
    output,
  };
}
