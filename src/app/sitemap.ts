import type { MetadataRoute } from "next";
import { hackathonPublic, site } from "@/data/site";
import { page } from "@/lib/base";

export const dynamic = "force-static";

// The public site only: the attendee app and crew console sit behind sign-in.
const paths = ["/", "/program", "/side-events", ...(hackathonPublic ? ["/hackathon"] : []), "/get-involved", "/reports/2025"];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((p) => ({ url: site.origin + page(p) }));
}
