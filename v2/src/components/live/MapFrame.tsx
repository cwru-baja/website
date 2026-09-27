import type { ReactNode, Ref } from "react";

/**
 * The map's box, shared by the placeholder shown while Leaflet loads and the
 * map itself, so the swap moves nothing. `isolate` keeps Leaflet's panes and
 * controls (z-index 400 to 1000) from rising over the fixed navbar.
 */
export function MapFrame({
  message,
  children,
  innerRef,
  innerClassName = "",
}: {
  message?: string | null;
  children?: ReactNode;
  innerRef?: Ref<HTMLDivElement>;
  innerClassName?: string;
}) {
  return (
    <div className="relative isolate aspect-[4/3] w-full overflow-hidden bg-surface lg:aspect-auto lg:h-full lg:min-h-[26rem]">
      <div ref={innerRef} className={`absolute inset-0 ${innerClassName}`} />
      {message && (
        <p className="absolute inset-0 z-[1000] flex items-center justify-center text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/35">
          {message}
        </p>
      )}
      {children}
    </div>
  );
}
