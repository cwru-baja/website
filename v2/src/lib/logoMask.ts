import { getImageProps } from "next/image";
import type { CSSProperties } from "react";

/**
 * The --logo-url a sponsor logo's link carries for its hover mask (--logo-url, see .logo-wall in
 * globals.css): the 2x candidate next/image puts in the logo's own srcset.
 *
 * The mask used to point at the trimmed source PNG, which next/image never
 * requests. A masked ::after downloads its image as soon as it renders, opacity
 * 0 or not, so every logo was fetched twice - the second time as an
 * unoptimised PNG (holley.png alone is 42 KB). The 2x candidate is the file a
 * 2x screen has already downloaded for the <img>, so there the mask is free;
 * anywhere else it is a small resized copy instead of the full PNG.
 */
export function logoMaskStyle(src: string, box: { width: number; height: number }): CSSProperties {
  return { "--logo-url": `url("${maskUrl(src, box)}")` } as CSSProperties;
}

function maskUrl(src: string, { width, height }: { width: number; height: number }): string {
  if (src.endsWith(".svg")) return src;
  // A fixed-width image's srcset is "<url> 1x, <url> 2x".
  const { srcSet } = getImageProps({ src, width, height, alt: "" }).props;
  const twoX = srcSet?.split(", ").find((candidate) => candidate.endsWith(" 2x"));
  return twoX ? twoX.slice(0, -" 2x".length) : src;
}
