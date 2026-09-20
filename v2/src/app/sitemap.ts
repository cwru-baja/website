import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The static export has no server to answer /sitemap.xml, so it is written out
// at build time like app/icon.tsx.
export const dynamic = "force-static";

// Every route under app/ that ships. Kept by hand: seven pages that change
// when someone adds a page, not on their own, so a generated list would only
// hide the decision. /lab and api/car-labels are dev-only (see next.config.ts)
// and never reach the export.
const ROUTES = ["/", "/car", "/team", "/competition", "/sponsors", "/support", "/contact"];

// No lastModified: it would have to be the build time, which changes on every
// deploy whether or not the page did, and a sitemap that cries wolf is worse
// than one that stays quiet. Add real dates here if they ever become known.
export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({ url: new URL(route, SITE_URL).href }));
}
