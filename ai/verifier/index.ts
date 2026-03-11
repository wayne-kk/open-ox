/**
 * Verifier - 代码校验
 * 执行 lint、build、typecheck 等验证
 */

import { execSync } from "child_process";
import { join } from "path";

const WORKSPACE = process.cwd();

export interface VerifyResult {
  success: boolean;
  /** 校验类型 */
  type: "lint" | "build" | "typecheck";
  /** 输出或错误信息 */
  output: string;
  /** 退出码 */
  exitCode?: number;
}

export interface VerifierOptions {
  /** 要执行的校验类型 */
  types?: ("lint" | "build" | "typecheck")[];
  /** 工作目录 */
  cwd?: string;
}

/**
 * 执行代码校验
 */
export async function verify(
  options: VerifierOptions = {}
): Promise<VerifyResult[]> {
  const { types = ["lint", "typecheck"], cwd = WORKSPACE } = options;
  const results: VerifyResult[] = [];

  for (const type of types) {
    try {
      const result = runVerify(type, cwd);
      results.push(result);
    } catch (err) {
      results.push({
        success: false,
        type,
        output: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

function runVerify(type: "lint" | "build" | "typecheck", cwd: string): VerifyResult {
  const commands: Record<typeof type, string> = {
    lint: "pnpm run lint 2>&1",
    build: "pnpm run build 2>&1",
    typecheck: "pnpm exec tsc --noEmit 2>&1",
  };

  const cmd = commands[type];
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    return {
      success: true,
      type,
      output: output?.trim() ?? "",
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    const output = [execErr.stdout, execErr.stderr].filter(Boolean).join("\n").trim();
    return {
      success: false,
      type,
      output: output || (err instanceof Error ? err.message : String(err)),
      exitCode: execErr.status,
    };
  }
}

/**
 * 校验是否全部通过
 */
export function allPassed(results: VerifyResult[]): boolean {
  return results.every((r) => r.success);
}

/**
 * 生成可反馈给 LLM 的错误摘要
 */
export function formatErrorsForLLM(results: VerifyResult[]): string {
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) return "";
  return failed
    .map((r) => `[${r.type}]\n${r.output}`)
    .join("\n\n---\n\n");
}
