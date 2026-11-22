import { preload } from "react-dom";

/**
 * Starts a self-hosted woff2 with the HTML instead of when layout first needs
 * it. crossOrigin must be "anonymous": fonts are always fetched in CORS mode, so
 * a preload without it is a different request and the font downloads twice.
 */
export function preloadFont(href: string) {
  preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}
