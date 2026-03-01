import type { NextConfig } from "next";
import path from "path";

const frontendNodeModules = path.resolve(__dirname, "node_modules");

const nextConfig: NextConfig = {
  // Webpack config: CSS @import resolution goes through webpack's enhanced-resolve.
  // Since the project root has no package.json, webpack can't walk up to find
  // frontend/node_modules via normal module resolution. We use resolve.alias to
  // explicitly map these CSS-imported packages to their installed locations.
  webpack: (config) => {
    config.resolve.modules = [
      frontendNodeModules,
      ...(config.resolve.modules || ["node_modules"]),
    ];
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      tailwindcss: path.resolve(frontendNodeModules, "tailwindcss"),
      "tw-animate-css": path.resolve(frontendNodeModules, "tw-animate-css"),
    };
    return config;
  },
  // Turbopack config: needed to satisfy Next.js 16 which errors if only
  // webpack config is present without a turbopack config.
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(frontendNodeModules, "tailwindcss"),
      "tw-animate-css": path.resolve(frontendNodeModules, "tw-animate-css"),
    },
  },
};

export default nextConfig;
