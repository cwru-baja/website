import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "path";

// Cloudflare Image Transformations only run on the real domain, so only the
// production branch's build points next/image at them. Workers Builds sets
// WORKERS_CI_BRANCH; local builds and branch previews (on workers.dev, where
// /cdn-cgi/image/ does not exist) serve the source files as they are.
const cloudflareImages = process.env.WORKERS_CI_BRANCH === "master";

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
