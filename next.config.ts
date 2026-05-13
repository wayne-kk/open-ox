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
   * Cover capture uses dynamic `import("playwright")`. Standalone file tracing does not
   * always pull in externals; without this, `.next/standalone/node_modules` omits playwright
   * and production/Docker hits "Install playwright..." in cover_image_error.
   */
  outputFileTracingIncludes: {
    "/*": ["node_modules/playwright/**/*", "node_modules/playwright-core/**/*"],
  },
  serverExternalPackages: ["playwright", "playwright-core"],
  async redirects() {
    return [{ source: "/login", destination: "/auth", permanent: true }];
  },
};

export default nextConfig;
