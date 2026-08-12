import type { NextConfig } from "next";

/**
 * Static export only when building for GitHub Pages (GITHUB_PAGES=true).
 * Normal / staff / API mode uses the standard Next.js server runtime.
 */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
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
