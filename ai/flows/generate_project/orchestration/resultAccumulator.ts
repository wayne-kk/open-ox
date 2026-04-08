import type { GenerateProjectResult } from "../types";
import type { StepLogger } from "../shared/logging";

export function createInitialResult(logger: StepLogger): GenerateProjectResult {
  return {
    success: false,
    verificationStatus: "failed",
    generatedFiles: [],
    unvalidatedFiles: [],
    installedDependencies: [],
    dependencyInstallFailures: [],
    steps: logger.resultSteps,
  };
}

export function appendGeneratedFiles(result: GenerateProjectResult, files: string[]): void {
  for (const path of files) {
    if (!result.generatedFiles.includes(path)) result.generatedFiles.push(path);
  }
}

export function appendInstalledDependencies(
  result: GenerateProjectResult,
  dependencies: GenerateProjectResult["installedDependencies"]
): void {
  for (const dependency of dependencies) {
    const existing = result.installedDependencies.find(
      (item) => item.packageName === dependency.packageName && item.dev === dependency.dev
    );
    if (!existing) {
      result.installedDependencies.push({ ...dependency, files: [...dependency.files] });
      continue;
    }
    existing.files = Array.from(new Set([...existing.files, ...dependency.files]));
  }
}

export function appendDependencyInstallFailures(
  result: GenerateProjectResult,
  failures: GenerateProjectResult["dependencyInstallFailures"]
): void {
  for (const failure of failures) {
    const existing = result.dependencyInstallFailures.find(
      (item) => item.packageName === failure.packageName && item.dev === failure.dev
    );
    if (!existing) {
      result.dependencyInstallFailures.push({ ...failure, files: [...failure.files] });
      continue;
    }
    existing.files = Array.from(new Set([...existing.files, ...failure.files]));
    existing.error = failure.error;
  }
}
