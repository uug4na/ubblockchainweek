import type { NextConfig } from "next";
import path from "node:path";

// A static site: pages + the browser talk straight to Supabase (no server of our own).
// scripts/deploy-pages.mjs builds it with NEXT_PUBLIC_BASE_PATH=/ubbw-2026 for GitHub Pages.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // GitHub Pages serves folder/index.html, so every route gets a trailing slash.
  trailingSlash: true,
  images: { unoptimized: true },
  // A stray package-lock.json in the home folder confuses root detection.
  turbopack: { root: path.resolve(__dirname) },
  // the dev-only "N" badge sits on the phone menu button
  devIndicators: false,
};

export default nextConfig;
