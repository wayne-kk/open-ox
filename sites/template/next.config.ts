import path from "node:path";
import type { NextConfig } from "next";

function splitCsv(v: string | undefined): string[] {
  return v?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
}

/**
 * Studio embeds preview in an iframe from `NEXT_PUBLIC_SITE_URL` (often `localhost:3000`) while the
 * child `next dev` may advertise `127.0.0.1:<port>`. Next.js 15+ blocks cross-origin `/_next/` fetches in
 * dev unless both loopback hosts are explicitly allowed — otherwise Chrome shows an empty iframe
 * (often reported as 「未发送任何数据」 / ERR_EMPTY_RESPONSE) while opening the preview URL directly still works.
 */
const allowedDevOrigins = [...new Set([
  "localhost",
  "127.0.0.1",
  ...splitCsv(process.env.OPEN_OX_PREVIEW_ALLOWED_DEV_ORIGINS),
  ...splitCsv(process.env.OPEN_OX_ALLOWED_DEV_ORIGINS),
  ...(() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!raw) return [];
    try {
      return [new URL(raw).hostname].filter(Boolean);
    } catch {
      return [];
    }
  })(),
])];

/** Path prefix (leading slash, no trailing slash) for Storage static export — `{NEXT_PUBLIC_SITE_URL}/site-previews/{url-encoded projectId}` so `/_next` resolves under the preview proxy; set only for that build (see `staticSitePreview.ts`). Public `public/*` URLs still use `/…` in HTML; the build post-process rewrites those to sit under this basePath. */
const staticBasePath = process.env.OPEN_OX_STATIC_BASE_PATH?.trim();

/**
 * Keep Turbopack + file tracing rooted on this site directory — not the open-ox monorepo.
 * If both point at the monorepo (or turbopack auto-infers it via the parent lockfile),
 * `next build` compiles the parent app's `proxy.ts` and fails. `turbopack.root` and
 * `outputFileTracingRoot` must match.
 */
const siteRoot = __dirname;

const nextConfig: NextConfig = {
  // Design Mode needs the webpack() loader below → local preview uses `next dev --webpack`.
  // Production `next build` stays on Turbopack with an isolated site root.
  turbopack: {
    root: siteRoot,
  },
  webpack(config, { dev }) {
    // Compile-time only (dev): inject data-ox-source into the module graph, never write to disk.
    // Direct Apply is gated separately (env + local backend). Production builds ignore this.
    if (dev) {
      config.module.rules.push({
        test: /\.[jt]sx$/,
        exclude: /node_modules/,
        enforce: "pre",
        use: [path.join(__dirname, "open-ox/source-instrumentation-loader.cjs")],
      });
    }
    return config;
  },
  allowedDevOrigins,
  ...(staticBasePath ? { basePath: staticBasePath } : {}),
  output: "export",
  outputFileTracingRoot: siteRoot,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**.placehold.co" },
    ],
  },
};

export default nextConfig;
