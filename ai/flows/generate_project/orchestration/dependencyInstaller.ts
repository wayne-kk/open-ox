import { stepInstallDependencies } from "../steps/installDependencies";

export async function installDependenciesForScope(params: {
  files: string[];
  buildOutput?: string;
}): Promise<void> {
  await stepInstallDependencies({
    files: params.files,
    buildOutput: params.buildOutput,
  });
}
