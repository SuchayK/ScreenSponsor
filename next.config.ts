import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: { "/*": ["./node_modules/ffmpeg-static/ffmpeg"] },
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
