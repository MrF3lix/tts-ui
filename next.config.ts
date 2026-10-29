import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server in .next/standalone, used by the Dockerfile
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
