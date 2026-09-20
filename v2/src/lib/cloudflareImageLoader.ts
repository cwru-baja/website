import type { ImageLoaderProps } from "next/image";

const TRANSFORM = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES === "1";

/**
 * next/image's resizer, now that no Next server runs: Cloudflare Image
 * Transformations, which resize any same-origin file through /cdn-cgi/image/.
 *
 * `format=auto` picks AVIF or WebP per browser and still counts as one
 * transformation. `onerror=redirect` sends the visitor to the source file if
 * Cloudflare will not transform it - which is what an exhausted monthly quota
 * looks like - so a bad month costs bytes, never a broken image.
 *
 * SVGs are never sent through it: there is nothing to resize, and each would
 * still spend a transformation. Callers mark them `unoptimized`, as next/image
 * did by itself before it had a custom loader; the check here is the backstop.
 *
 * Off (see next.config.ts) the source file is served untouched. The width still
 * rides along as a query string the host ignores, because next/image warns
 * about a loader that does not use it.
 */
export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.endsWith(".svg")) return src;
  if (!TRANSFORM) return `${src}?w=${width}`;

  const options = [`width=${width}`, `quality=${quality ?? 75}`, "format=auto", "onerror=redirect"];
  return `/cdn-cgi/image/${options.join(",")}/${src.replace(/^\//, "")}`;
}
