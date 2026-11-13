import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { withBase, page } from "@/lib/base";

export const dynamic = "force-static";

// The crew console installs as its own app, separate from the attendee one.
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: withBase("/staff"),
    name: `${site.short} Crew`,
    short_name: "UBBW Crew",
    description: "Scan passes, hand out merch and run the week.",
    start_url: page("/staff"),
    scope: withBase("/staff"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#02041e",
    theme_color: "#02041e",
    lang: "en",
    icons: [
      { src: withBase("/icons/crew-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icons/crew-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icons/crew-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Scan a pass", url: page("/staff/scan"), icons: [{ src: withBase("/icons/crew-192.png"), sizes: "192x192" }] }],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
