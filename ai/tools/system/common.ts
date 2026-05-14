import { AsyncLocalStorage } from "node:async_hooks";
import { join, sep } from "path";

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
 * Site root context — bound per-request via AsyncLocalStorage so concurrent
 * generate / modify flows on the same Node process never trample
 * each other's working directory. There is no module-level fallback: callers
 * MUST wrap their flow with {@link runWithSiteRoot}, otherwise reads/writes
 * throw a hard error rather than silently falling back to `process.cwd()` or
 * `sites/template`.
 */
interface SiteRootContext {
  /** Mutable so that {@link setSiteRoot} can refine it during a flow. */
  siteRoot: string;
}

const siteRootStore = new AsyncLocalStorage<SiteRootContext>();

const SITES_DIR = runtimeJoin(WORKSPACE_ROOT, "sites");
const TEMPLATE_DIR = runtimeJoin(SITES_DIR, "template");

/**
 * Reject paths that would let an agent flow write into the canonical template
 * directory. The only legitimate writer of `sites/template/` is a developer
 * editing the source tree by hand.
 */
function assertNotTemplate(path: string): void {
  const normalised = path.replace(/[/\\]+$/, "");
  if (normalised === TEMPLATE_DIR) {
    throw new Error(
      `setSiteRoot: refusing to point site root at sites/template. ` +
        `Generated content must live in sites/<projectId>/.`
    );
  }
}

/**
 * Validate `path` is inside `WORKSPACE_ROOT/sites/` and is not the template.
 */
function assertSiteRootShape(path: string): void {
  const normalised = path.replace(/[/\\]+$/, "");
  if (
    !normalised.startsWith(SITES_DIR + sep) &&
    !normalised.startsWith(SITES_DIR + "/") &&
    !normalised.startsWith(SITES_DIR + "\\")
  ) {
    throw new Error(
      `setSiteRoot: path "${path}" is outside WORKSPACE_ROOT/sites/ ("${SITES_DIR}")`
    );
  }
  assertNotTemplate(normalised);
}

/**
 * Run `fn` with `siteRoot` bound for the duration of the async chain. All
 * downstream `getSiteRoot()` / `resolvePath()` calls observe this value and it
 * cannot be mutated by sibling flows running concurrently.
 */
export function runWithSiteRoot<T>(siteRoot: string, fn: () => Promise<T>): Promise<T> {
  assertSiteRootShape(siteRoot);
  return siteRootStore.run({ siteRoot }, fn);
}

/**
 * Returns the active site root for the current async context. Throws if the
 * caller forgot to wrap the flow with {@link runWithSiteRoot}.
 */
export function getSiteRoot(): string {
  const ctx = siteRootStore.getStore();
  if (!ctx) {
    throw new Error(
      "getSiteRoot called outside of a runWithSiteRoot scope — refusing to fall back to a default. " +
        "Wrap your flow with runWithSiteRoot(getSiteRoot(projectId), () => ...) at the entry point."
    );
  }
  return ctx.siteRoot;
}

/**
 * Replace the site root for the current async context. Mostly used by flows
 * that need to refine the root partway through (e.g. after resolving a
 * project record). Calls outside of a {@link runWithSiteRoot} scope throw.
 */
export function setSiteRoot(path: string): void {
  assertSiteRootShape(path);
  const ctx = siteRootStore.getStore();
  if (!ctx) {
    throw new Error(
      `setSiteRoot called outside of a runWithSiteRoot scope. ` +
        `Wrap your flow with runWithSiteRoot(${JSON.stringify(path)}, ...) instead.`
    );
  }
  ctx.siteRoot = path;
}

/**
 * Try to read the active site root without throwing. Returns `null` when no
 * context is bound. Use this only in best-effort logging / diagnostic paths;
 * production code paths must use {@link getSiteRoot} so the missing-context
 * bug surfaces loudly.
 */
export function tryGetSiteRoot(): string | null {
  return siteRootStore.getStore()?.siteRoot ?? null;
}

/**
 * 安全路径：不允许跳出当前 SITE_ROOT，也不允许解析到 sites/template/。
 * Resolves relative to the active async-local site root. The template-dir
 * check is a depth-defence belt so misbehaving tools that bypass setSiteRoot
 * still cannot corrupt the canonical template tree.
 */
export function resolvePath(relativePath: string): string {
  const root = getSiteRoot();
  const resolved = runtimeJoin(root, relativePath);
  if (!resolved.startsWith(root)) {
    throw new Error(`Path outside SITE_ROOT: ${relativePath}`);
  }
  if (
    resolved === TEMPLATE_DIR ||
    resolved.startsWith(TEMPLATE_DIR + sep) ||
    resolved.startsWith(TEMPLATE_DIR + "/")
  ) {
    throw new Error(
      `resolvePath: refusing to operate on sites/template/ ("${relativePath}"). ` +
        `Generated content must live under sites/<projectId>/.`
    );
  }
  return resolved;
}
