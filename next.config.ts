import type { NextConfig } from "next";

/** Comma-separated hosts or origins (see Next.js `allowedDevOrigins`), e.g. `192.168.31.254` or `http://192.168.31.254:3000`. */
const allowedDevOrigins =
  process.env.OPEN_OX_ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  output: "standalone",
  /**
   * Production: use webpack (`pnpm build` → `next build --webpack`). Turbopack production builds
   * turn `serverExternalPackages` like `playwright` into hashed import specifiers Node cannot resolve
   * (ERR_MODULE_NOT_FOUND: playwright-…).
   *
   * Playwright is used for cover capture / reference URLs. Standalone tracing must include its files;
   * without outputFileTracingIncludes, `.next/standalone/node_modules` may omit playwright.
   */
  outputFileTracingIncludes: {
    /**
     * LLM prompts + design-system `skills.yaml` are read at runtime via `fs` + `process.cwd()` (see
     * `matchDesignSystemSkill`). Standalone tracing does not infer these paths; include them explicitly
     * or Docker/production may ship a build where catalog is missing or stale.
     */
    "/*": [
      "node_modules/playwright/**/*",
      "node_modules/playwright-core/**/*",
      "ai/flows/generate_project/prompts/skills/**/*",
    ],
  },
  serverExternalPackages: ["playwright", "playwright-core"],
  async redirects() {
    return [{ source: "/login", destination: "/auth", permanent: true }];
  },
};

export default nextConfig;
