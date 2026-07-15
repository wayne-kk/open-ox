import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** Comma-separated hosts or origins (see Next.js `allowedDevOrigins`), e.g. `192.168.31.254` or `http://192.168.31.254:3000`. */
const allowedDevOrigins =
  process.env.OPEN_OX_ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  output: "standalone",
  /**
   * CI already runs `pnpm typecheck` before deploy. Skipping Next's in-build tsc avoids a second
   * cold typecheck on small CVMs (often several minutes during `pnpm build`).
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  /**
   * Turbopack is the default production bundler. Playwright / sharp run in the
   * Screenshot Service (`scripts/screenshot-service.ts`), not in Next — cover and
   * reference capture call `lib/screenshot/client` over HTTP. Keep tracing includes
   * for any residual native deps / standalone copies.
   */
  outputFileTracingIncludes: {
    /**
     * LLM prompts + section skill catalogs are read at runtime via `fs` + `process.cwd()`.
     * Standalone tracing does not infer these paths; include them explicitly
     * or Docker/production may ship a build where catalogs are missing or stale.
     */
    "/*": [
      "node_modules/playwright/**/*",
      "node_modules/playwright-core/**/*",
      "node_modules/sharp/**/*",
      "node_modules/detect-libc/**/*",
      "ai/**/*",
    ],
  },
  serverExternalPackages: ["playwright", "playwright-core", "sharp"],
  async redirects() {
    return [{ source: "/login", destination: "/auth", permanent: true }];
  },
};

export default withNextIntl(nextConfig);
