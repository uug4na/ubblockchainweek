import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { withBase, page } from "@/lib/base";

export const dynamic = "force-static";

// The attendee app, as installed to a phone's home screen.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: withBase("/app"),
    name: `${site.short} — attendee app`,
    short_name: site.short,
    description: `Your pass, schedule, stars and merch for ${site.name}.`,
    start_url: page("/app"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#02041e",
    theme_color: "#02041e",
    lang: "en",
    categories: ["events", "social"],
    icons: [
      { src: withBase("/icons/app-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icons/app-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icons/app-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan a poster", url: page("/app/scan"), icons: [{ src: withBase("/icons/app-192.png"), sizes: "192x192" }] },
      { name: "My pass", url: page("/app/profile"), icons: [{ src: withBase("/icons/app-192.png"), sizes: "192x192" }] },
      { name: "Merch", url: page("/app/merch"), icons: [{ src: withBase("/icons/app-192.png"), sizes: "192x192" }] },
    ],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
