import type { NextConfig } from "next";

// The app is fully per-user (everything behind login), so pages are rendered
// dynamically on each request; Cache Components / PPR are not used.
const nextConfig: NextConfig = {
  // pdfkit reads its data files from disk at runtime: keep it out of the bundle
  serverExternalPackages: ["pdfkit"],
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
