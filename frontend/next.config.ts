import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const frontendNodeModules = path.resolve(__dirname, "node_modules");

// Backend URL used by the Next.js server-side proxy.
// In Docker Compose this is the internal service name (never exposed to browser).
// For local dev without Docker, falls back to localhost:8921.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8921";

const nextConfig: NextConfig = {
  // Proxy all /api/v1/* calls to the backend container.
  // The browser only ever talks to the Next.js server (one origin, one port).
  // This eliminates CORS issues and lets the frontend port be changed freely.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },

  // Webpack: CSS @import resolution needs explicit module path because the
  // project root has no package.json and webpack can't walk up to find
  // frontend/node_modules automatically.
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

  // Turbopack config: required alongside webpack config in Next.js 16.
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(frontendNodeModules, "tailwindcss"),
      "tw-animate-css": path.resolve(frontendNodeModules, "tw-animate-css"),
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "yakuraku",
  project: "resumate-frontend",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
