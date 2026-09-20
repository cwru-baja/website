import { CURRENT_THEME } from "@/lib/livery";

// The browser-tab M, filled with the current car's livery. Generated at build
// time like a static icon, so flipping CURRENT_CAR re-colours it too.
export const contentType = "image/svg+xml";
// The static export has no server to answer /icon, so it is written out once.
export const dynamic = "force-static";

export default function Icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86 86">
  <g fill="${CURRENT_THEME.livery}">
    <polygon points="86,26 73,26 53.5,59.8 66.4,59.8"/>
    <polygon points="33.9,59.8 47,59.8 66.5,26 53.4,26"/>
    <polygon points="27.3,37.3 14.3,59.8 27.3,59.8 46.9,26 0,26"/>
  </g>
</svg>`;
  return new Response(svg, { headers: { "Content-Type": contentType } });
}
