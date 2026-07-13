import { describe, expect, it } from "vitest";
import { patchGeneratedSiteNextConfigSource } from "./ensureGeneratedSiteTurbopackRoot";

describe("patchGeneratedSiteNextConfigSource", () => {
  it("expands empty turbopack config and pins tracing root to __dirname", () => {
    const input = `
const nextConfig: NextConfig = {
  turbopack: {},
  webpack(config, { dev }) {
    return config;
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};
`;
    const out = patchGeneratedSiteNextConfigSource(input);
    expect(out).toContain("root: __dirname");
    expect(out).toContain("outputFileTracingRoot: __dirname");
    expect(out).not.toContain('path.join(__dirname, "../..")');
    expect(out).not.toMatch(/turbopack:\s*\{\s*\}/);
  });

  it("injects turbopack.root when the key is missing", () => {
    const input = `
const nextConfig: NextConfig = {
  webpack(config) {
    return config;
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};
`;
    const out = patchGeneratedSiteNextConfigSource(input);
    expect(out).toContain("turbopack: {");
    expect(out).toContain("root: __dirname");
    expect(out).toContain("outputFileTracingRoot: __dirname");
  });
});
