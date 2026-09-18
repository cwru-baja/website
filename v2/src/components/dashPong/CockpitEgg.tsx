"use client";

// The cockpit hold's easter egg: press any blue button on the wheel and the dash
// becomes Pong; press one again, hit Esc, or finish a game to five and it comes
// back.
//
// Mount inside the cockpit still's 16:9 box, in a layer that is only shown while
// the still is exactly layers/cockpit-dive-0040 (.webp or .avif) - every asset
// here was rendered or measured from that frame's camera.
//
// While a game runs the page is held where it is: `freeze` asks the sequence to
// stop the scroll and hands back a release. The sequence can also let go on its
// own - a scroll up, the progress rail, a resize - and says so through
// `onRelease`, which ends the game.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import DashPong from "./DashPong";
import WheelButtons from "./WheelButtons";

/** The still every cockpit asset was made against, as a layer name: its URL
 * depends on the format the page loaded (layerUrl). */
export const COCKPIT_STILL = "cockpit-dive-0040";

export type Freeze = (onRelease: () => void) => () => void;

export default function CockpitEgg({ freezeRef }: { freezeRef: RefObject<Freeze | null> }) {
  const [playing, setPlaying] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    const release = releaseRef.current;
    releaseRef.current = null;
    release?.();
  }, []);

  const start = useCallback(() => {
    setPlaying(true);
    releaseRef.current =
      freezeRef.current?.(() => {
        releaseRef.current = null;
        setPlaying(false);
      }) ?? null;
  }, [freezeRef]);

  // Unmounting mid-game (leaving the page) must not leave the scroll held.
  useEffect(() => () => releaseRef.current?.(), []);

  return (
    // Its own box, so the caption can size off the still's width (cqw).
    <div className="pointer-events-none absolute inset-0" style={{ containerType: "inline-size" }}>
      <DashPong playing={playing} onEnd={stop} />
      <WheelButtons dark={playing} onPress={() => (playing ? stop() : start())} />
      <p
        aria-hidden
        className="absolute inset-x-0 text-center font-clash font-medium uppercase leading-none tracking-[0.18em] text-white"
        style={{
          bottom: "3%",
          fontSize: "clamp(0.625rem, 0.9cqw, 0.8125rem)",
          opacity: playing ? 0.6 : 0,
          transition: "opacity 200ms ease-out",
        }}
      >
        W / S or mouse &middot; &uarr; &darr; player two &middot; Esc to leave
      </p>
    </div>
  );
}
