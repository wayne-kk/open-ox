import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** Comma-separated hosts or origins (see Next.js `allowedDevOrigins`), e.g. `192.168.31.254` or `http://192.168.31.254:3000`. */
const allowedDevOrigins =
  process.env.OPEN_OX_ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

/**
 * Host-based rewrites for dedicated preview origin (`NEXT_PUBLIC_PREVIEW_ORIGIN`).
 * Needed so `.js` / `.css` (excluded from `proxy.ts` matcher) still map
 * `/{projectId}/_next/...` → `/site-previews/{projectId}/_next/...`.
 */
function dedicatedPreviewHostRewrites(): {
  source: string;
  has: { type: "host"; value: string }[];
  destination: string;
}[] {
  const preview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN?.trim();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!preview || !site) return [];
  let previewHost: string;
  let siteHost: string;
  try {
    previewHost = new URL(preview).hostname.toLowerCase();
    siteHost = new URL(site).hostname.toLowerCase();
  } catch {
    return [];
  }
  if (!previewHost || previewHost === siteHost) return [];
  // Negative lookahead keeps /open-ox, /api, /_next, /health, /site-previews off the projectId route.
  const projectId = ":projectId((?!open-ox|_next|api|health|site-previews)[^/]+)";
  return [
    {
      source: `/${projectId}`,
      has: [{ type: "host", value: previewHost }],
      destination: "/site-previews/:projectId",
    },
    {
      source: `/${projectId}/:path*`,
      has: [{ type: "host", value: previewHost }],
      destination: "/site-previews/:projectId/:path*",
    },
  ];
}

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
   * Playwright / sharp stay external; cover capture uses the Screenshot Service.
   * Runtime `fs` under `sites/` / `ai/` is intentional — see `turbopack.ignoreIssue`.
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
  /**
   * pnpm may leave `@tabby_ai/hijri-converter` as a directory symlink; Turbopack NFT
   * panics hashing it ("Is a directory"). Unused by the host app (only sites/template).
   */
  outputFileTracingExcludes: {
    "/*": [
      "node_modules/@tabby_ai/hijri-converter/**/*",
      "node_modules/.pnpm/**/node_modules/@tabby_ai/hijri-converter/**/*",
      "node_modules/react-day-picker/**/*",
      "node_modules/.pnpm/**/node_modules/react-day-picker/**/*",
    ],
  },
  serverExternalPackages: ["playwright", "playwright-core", "sharp"],
  /**
   * Preview / generation code walks `sites/<id>` at runtime. Turbopack NFT cannot
   * bound those dynamic joins and would otherwise warn (or list next.config in NFT).
   */
  turbopack: {
    ignoreIssue: [
      {
        path: "**/lib/staticSitePreview.ts",
        title: /NFT|file pattern|unexpected file/i,
      },
      {
        path: "**/lib/previewShared.ts",
        title: /NFT|file pattern|unexpected file/i,
      },
      {
        path: "**/lib/studio/designMode/sourceInstrumentation/stripOxSource.ts",
        title: /NFT|file pattern|unexpected file/i,
      },
      {
        path: "**/ai/flows/generate_project/shared/userProvidedImageEnforcement.ts",
        title: /NFT|file pattern|unexpected file/i,
      },
      {
        path: "**/next.config.ts",
        title: /unexpected file in NFT list/i,
      },
    ],
  },
  async redirects() {
    return [{ source: "/login", destination: "/auth", permanent: true }];
  },
  async rewrites() {
    const previewRewrites = dedicatedPreviewHostRewrites();
    if (previewRewrites.length === 0) return [];
    return { beforeFiles: previewRewrites };
  },
};

export default withNextIntl(nextConfig);
