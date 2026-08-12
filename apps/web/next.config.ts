import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages.
 * Project site URL: https://diosnr.github.io/nysc-ekiti-digital-platform/
 *
 * basePath / assetPrefix are only applied when building for Pages
 * (GITHUB_PAGES=true). Local `next dev` and normal builds stay at root.
 */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(isGithubPages
    ? {
        basePath: "/nysc-ekiti-digital-platform",
        assetPrefix: "/nysc-ekiti-digital-platform",
      }
    : {}),
};

export default nextConfig;
