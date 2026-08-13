import type { NextConfig } from "next";
import path from "path";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Monorepo local packages
  transpilePackages: ["@nysc/auth", "@nysc/verification", "@nysc/database"],
  experimental: {
    // Allow server to reach outside apps/web for workspace packages
    externalDir: true,
  },
  ...(isGithubPages
    ? {
        output: "export" as const,
        trailingSlash: true,
        basePath: "/nysc-ekiti-digital-platform",
        assetPrefix: "/nysc-ekiti-digital-platform",
      }
    : {}),
};

export default nextConfig;
