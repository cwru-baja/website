import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "path";

// Cloudflare Image Transformations only run on a domain whose DNS is on
// Cloudflare, so next/image is only pointed at them when both hold:
// - CLOUDFLARE_IMAGES=1, a build variable set in the Worker's build settings
//   once the site is served from the real domain, and
// - the build is of master. Workers Builds sets WORKERS_CI_BRANCH, and branch
//   previews live on workers.dev, where /cdn-cgi/image/ does not exist.
// Everywhere else - local builds included - the source files are served as is.
const cloudflareImages =
  process.env.CLOUDFLARE_IMAGES === "1" && process.env.WORKERS_CI_BRANCH === "master";

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    // The site is served as plain files from Cloudflare, so there is no server.
    output: "export",
    // `*.dev.ts(x)` routes exist only under `next dev`: api/car-labels, which
    // writes to the source tree and is a POST handler no static export can
    // hold, and the /lab pages, which are workbenches, not part of the site.
    pageExtensions: dev ? ["dev.ts", "dev.tsx", "ts", "tsx"] : ["ts", "tsx"],
    images: {
      loader: "custom",
      loaderFile: "./src/lib/cloudflareImageLoader.ts",
    },
    env: {
      NEXT_PUBLIC_CLOUDFLARE_IMAGES: cloudflareImages ? "1" : "",
    },
    turbopack: {
      root: path.resolve(__dirname),
    },
  };
}
