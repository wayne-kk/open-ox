/**
 * Node.js ShellExecutor adapter using child_process.
 */

import { execSync } from "child_process";
import type { ShellExecutor, ShellExecOptions, ShellExecResult } from "../types";

export class NodeShellExecutor implements ShellExecutor {
  async exec(command: string, options?: ShellExecOptions): Promise<ShellExecResult> {
    try {
      const stdout = execSync(command, {
        cwd: options?.cwd,
        timeout: options?.timeout ?? 120_000,
        maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
        encoding: "utf-8",
        env: options?.env ? { ...process.env, ...options.env } : undefined,
      });

      return { stdout: stdout ?? "", stderr: "", exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        exitCode: err.status ?? 1,
      };
    }
  }
}

export function createNodeShellExecutor(): NodeShellExecutor {
  return new NodeShellExecutor();
}
