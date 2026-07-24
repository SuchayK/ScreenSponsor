import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
