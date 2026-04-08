import { stepInstallDependencies } from "../steps/installDependencies";
import type { ArtifactLogger, StepLogger } from "../shared/logging";
import type { GenerateProjectResult } from "../types";

export async function installDependenciesForScope(params: {
  scope: string;
  files: string[];
  artifactLogger: ArtifactLogger;
  result: GenerateProjectResult;
  logger: StepLogger;
}): Promise<void> {
  await stepInstallDependencies({
    scope: params.scope,
    files: params.files,
    artifactLogger: params.artifactLogger,
    result: params.result,
    logger: params.logger,
  });
}
