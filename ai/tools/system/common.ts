import { join } from "path";

/** 当前 open-ox 仓库根目录（AI 引擎所在项目） */
export const WORKSPACE_ROOT = process.cwd();

/**
 * 目标站点根目录（用于写入生成的网站代码）
 * - 通过环境变量 SITE_ROOT 指定相对 open-ox 的路径，例如：SITE_ROOT=sites/template
 * - 如果未配置，则默认等于 WORKSPACE_ROOT（向后兼容）
 */
export const SITE_ROOT = process.env.SITE_ROOT
  ? join(WORKSPACE_ROOT, process.env.SITE_ROOT)
  : WORKSPACE_ROOT;

/** 安全路径：不允许跳出 SITE_ROOT */
export function resolvePath(relativePath: string): string {
  const resolved = join(SITE_ROOT, relativePath);
  const real = resolved.replace(/\/+/g, "/");
  if (!real.startsWith(SITE_ROOT)) {
    throw new Error(`Path outside SITE_ROOT: ${relativePath}`);
  }
  return real;
}


