import type { ComponentProps } from "react";

// The CWRU Motorsports M, inline so it takes its colour from CSS (text-livery)
// and follows the car's livery. The intro's mask in globals.css
// (.logo-intro-mask) carries the same geometry; keep the two in sync.
const VIEW_BOX = "0 0 86.032411 33.80959";
export const M_LOGO_ASPECT = 86.032411 / 33.80959;

export default function MLogo({ ref, ...props }: ComponentProps<"svg">) {
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={VIEW_BOX} fill="currentColor" {...props}>
      <g transform="matrix(0.26458333,0,0,0.26458334,-237.72456,-27.618232)" fillRule="evenodd">
        <path d="m 0,0 h -36.798 l -55.447,-95.838 h 36.796 z" transform="matrix(1.3333333,0,0,-1.3333333,1223.6484,104.38413)" />
        <path d="M 0,0 H 37.049 L 92.345,95.838 H 55.297 Z" transform="matrix(1.3333333,0,0,-1.3333333,1026.724,232.168)" />
        <path d="M 0,0 -36.949,-63.892 H 0 L 55.447,31.946 H -77.552 Z" transform="matrix(1.3333333,0,0,-1.3333333,1001.8893,146.97853)" />
      </g>
    </svg>
  );
}
