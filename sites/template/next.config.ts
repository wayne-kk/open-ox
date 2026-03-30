import path from "node:path";
import type { NextConfig } from "next";

/**
 * Monorepo: pnpm lockfile and workspace root live above `sites/template`.
 * Aligns file tracing with the repo root so Next does not infer the wrong project root
 * (reduces "multiple lockfiles / inferred workspace root" noise during `pnpm run build`).
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
    ],
  },
};

export default nextConfig;
