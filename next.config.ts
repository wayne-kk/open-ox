import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright"],
  async redirects() {
    return [{ source: "/login", destination: "/auth", permanent: true }];
  },
};

export default nextConfig;
