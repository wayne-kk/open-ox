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

/**
 * Monorepo: pnpm lockfile and workspace root live above `sites/template`.
 * Aligns file tracing with the repo root so Next does not infer the wrong project root
 * (reduces "multiple lockfiles / inferred workspace root" noise during `pnpm run build`).
 */
/** Path prefix (leading slash, no trailing slash) for Storage static export — `{NEXT_PUBLIC_SITE_URL}/site-previews/{url-encoded projectId}` so `/_next` resolves under the preview proxy; set only for that build (see `staticSitePreview.ts`). Public `public/*` URLs still use `/…` in HTML; the build post-process rewrites those to sit under this basePath. */
const staticBasePath = process.env.OPEN_OX_STATIC_BASE_PATH?.trim();

const nextConfig: NextConfig = {
  allowedDevOrigins,
  ...(staticBasePath ? { basePath: staticBasePath } : {}),
  output: "export",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    unoptimized: true,
    remotePatterns: [
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
