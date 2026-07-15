/**
 * Runtime `require` rooted at the app `package.json`.
 * Use for native / heavy packages that Turbopack must not rewrite into hashed
 * externals (`pkg-<hash>` → ERR_MODULE_NOT_FOUND). See Next.js #87737 / #89037.
 */
import { createRequire } from "node:module";
import path from "node:path";

const requireFromApp = createRequire(path.join(process.cwd(), "package.json"));

export function requireFromProject<T = unknown>(packageName: string): T {
  return requireFromApp(packageName) as T;
}
