// The app is a static site. On GitHub Pages it lives under /ubbw-2026
// (NEXT_PUBLIC_BASE_PATH, set by scripts/deploy-pages.mjs); in local dev at the root.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// For plain URLs that Next doesn't prefix for us (window.location, <img>, the service worker…).
export const withBase = (path: string) => BASE + path;

// A page URL: the static export serves folder/index.html, so pages end in "/".
export const page = (path: string) => withBase(path) + (path.endsWith("/") ? "" : "/");
