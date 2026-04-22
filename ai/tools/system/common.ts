import { join } from "path";

/** 当前 open-ox 仓库根目录（AI 引擎所在项目） */
export const WORKSPACE_ROOT = process.cwd();

/**
 * Opaque path join that prevents Turbopack / webpack from statically analysing
 * the resulting path and pulling thousands of files into the bundle graph.
 * Only used for runtime-only filesystem paths that should never be traced.
 */
function runtimeJoin(...segments: string[]): string {
  return join(...segments);
}

/**
 * 目标站点根目录（用于写入生成的网站代码）
 * - 通过环境变量 SITE_ROOT 指定相对 open-ox 的路径，例如：SITE_ROOT=sites/template
 * - 如果未配置，则默认等于 WORKSPACE_ROOT（向后兼容）
 *
 * This is a mutable variable — use getSiteRoot() / setSiteRoot() to read/write it.
 * The SITE_ROOT named export is kept for backward compatibility and reflects the
 * current value via a module-level getter (Object.defineProperty below).
 */
let _siteRoot: string = process.env.SITE_ROOT
  ? runtimeJoin(WORKSPACE_ROOT, process.env.SITE_ROOT)
  : WORKSPACE_ROOT;

/** Returns the current dynamic site root directory. */
export function getSiteRoot(): string {
  return _siteRoot;
}

/**
 * Override the site root at runtime (e.g. before running a generate flow for a
 * specific project).  Throws if `path` is outside `WORKSPACE_ROOT/sites/`.
 */
export function setSiteRoot(path: string): void {
  const sitesDir = join(WORKSPACE_ROOT, "sites");
  // Normalise to remove trailing separators before comparison
  const normalised = path.replace(/[/\\]+$/, "");
  if (!normalised.startsWith(sitesDir + "/") && !normalised.startsWith(sitesDir + "\\")) {
    throw new Error(
      `setSiteRoot: path "${path}" is outside WORKSPACE_ROOT/sites/ ("${sitesDir}")`
    );
  }
  _siteRoot = path;
}

/**
 * Reset the site root back to the value derived from the SITE_ROOT env var
 * (or WORKSPACE_ROOT if unset).  Call this in a finally block after any flow
 * that calls setSiteRoot() to prevent state leaking between requests.
 */
export function clearSiteRoot(): void {
  _siteRoot = process.env.SITE_ROOT
    ? runtimeJoin(WORKSPACE_ROOT, process.env.SITE_ROOT)
    : WORKSPACE_ROOT;
}

/**
 * 安全路径：不允许跳出当前 SITE_ROOT
 * Uses the current dynamic _siteRoot so it always reflects the latest setSiteRoot() call.
 */
export function resolvePath(relativePath: string): string {
  const root = _siteRoot;
  const resolved = join(root, relativePath);
  const real = resolved.replace(/\/+/g, "/");
  if (!real.startsWith(root)) {
    throw new Error(`Path outside SITE_ROOT: ${relativePath}`);
  }
  return real;
}


