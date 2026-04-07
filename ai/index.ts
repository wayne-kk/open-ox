/**
 * AI Engine - 建站 Flow 主入口
 */

import { runGenerateProject } from "./flows";

export interface ProcessInputOptions {
  /** 每个步骤完成时的回调（用于 SSE 流式推送） */
  onStep?: (step: import("./flows").BuildStep) => void;
}

export interface ProcessResult {
  content: string;
  /** 生成的文件列表 */
  generatedFiles?: string[];
  blueprint?: import("./flows").PlannedProjectBlueprint;
  verificationStatus?: import("./flows").VerificationStatus;
  unvalidatedFiles?: string[];
  installedDependencies?: import("./flows").AutoInstalledDependency[];
  dependencyInstallFailures?: import("./flows").DependencyInstallFailure[];
  /** 各步执行状态 */
  buildSteps?: import("./flows").BuildStep[];
  logDirectory?: string;
  buildTotalDuration?: number;
}

function buildProcessContent(result: import("./flows").GenerateProjectResult): string {
  const fileSummary = `生成了 ${result.generatedFiles.length} 个文件：\n${result.generatedFiles.join("\n")}`;
  const logSummary = result.logDirectory ? `\n\n日志目录：${result.logDirectory}` : "";
  const installedSummary =
    result.installedDependencies.length > 0
      ? `\n\n自动安装依赖：${result.installedDependencies.map((item) => item.packageName).join(", ")}`
      : "";
  const installFailureSummary =
    result.dependencyInstallFailures.length > 0
      ? `\n\n依赖安装失败：${result.dependencyInstallFailures
          .map((item) => `${item.packageName} (${item.error})`)
          .join("; ")}`
      : "";

  if (result.verificationStatus === "passed") {
    return `项目构建完成并通过校验。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`;
  }

  return `项目文件已写入正式目录，但当前未通过校验，相关生成文件已标记。\n${fileSummary}${installedSummary}${installFailureSummary}${logSummary}`;
}

/**
 * 处理建站请求
 */
export async function processInput(
  userInput: string,
  options: ProcessInputOptions = {}
): Promise<ProcessResult> {
  const result = await runGenerateProject(userInput, options.onStep);

  return {
    content: result.success ? buildProcessContent(result) : `项目生成失败：${result.error}`,
    generatedFiles: result.generatedFiles,
    blueprint: result.blueprint,
    verificationStatus: result.verificationStatus,
    unvalidatedFiles: result.unvalidatedFiles,
    installedDependencies: result.installedDependencies,
    dependencyInstallFailures: result.dependencyInstallFailures,
    buildSteps: result.steps,
    logDirectory: result.logDirectory,
    buildTotalDuration: result.totalDuration,
  };
}

export { runGenerateProject } from "./flows";
export type {
  AutoInstalledDependency,
  BuildStep,
  CapabilityPriority,
  CapabilitySpec,
  DependencyInstallFailure,
  DependencyInstallTrigger,
  DesignIntent,
  GuardrailId,
  GenerateProjectResult,
  InformationArchitecture,
  InteractionTrait,
  LayoutTrait,
  MotionTrait,
  PageBlueprint,
  PageDesignPlan,
  PageMapEntry,
  PlannedProjectBlueprint,
  ProjectBrief,
  ProductScope,
  ProjectBlueprint,
  ProjectExperience,
  ProjectSiteBlueprint,
  RolePriority,
  SectionDesignPlan,
  SectionSpec,
  SectionTraits,
  ShellPlacement,
  TaskLoop,
  UserRole,
  VerificationStatus,
  VisualTrait,
} from "./flows";
