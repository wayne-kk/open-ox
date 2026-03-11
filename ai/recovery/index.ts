/**
 * Recovery / Retry - 失败重试与回滚
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

const WORKSPACE = process.cwd();

/** 写入前的文件备份 */
const backups = new Map<string, string>();

/**
 * 备份文件（在写入前调用）
 */
export function backupBeforeWrite(relativePath: string): void {
  const fullPath = join(WORKSPACE, relativePath);
  if (existsSync(fullPath)) {
    backups.set(relativePath, readFileSync(fullPath, "utf-8"));
  }
}

/**
 * 回滚单个文件
 */
export function rollbackFile(relativePath: string): boolean {
  const content = backups.get(relativePath);
  const fullPath = join(WORKSPACE, relativePath);
  if (content !== undefined) {
    writeFileSync(fullPath, content, "utf-8");
    backups.delete(relativePath);
    return true;
  }
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
    return true;
  }
  return false;
}

/**
 * 回滚所有已记录的文件
 */
export function rollbackAll(writtenPaths: string[]): { rolled: string[]; failed: string[] } {
  const rolled: string[] = [];
  const failed: string[] = [];
  for (const p of writtenPaths) {
    if (rollbackFile(p)) rolled.push(p);
    else failed.push(p);
  }
  return { rolled, failed };
}

export interface RetryOptions {
  maxRetries?: number;
  /** 重试前回调，可修改 input */
  onRetry?: (attempt: number, error: string) => void;
}

/**
 * 带重试的执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, onRetry } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, msg);
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}
