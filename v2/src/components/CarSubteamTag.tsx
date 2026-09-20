"use client";

import { useState } from "react";

/**
 * Who built the part the sequence has stopped on, in the still's bottom-left
 * corner. Desktop only: the phone's caption band already names the chapter.
 *
 * That corner is the one place dark in all five pause stills - measured off the
 * rendered layers, nothing brighter than 16/255 below 83% of the frame in the
 * left fifth - and no placed label reaches it: the lowest one sits at 93% but
 * starts 39% across. It is also inside the 5% edge margin a broadcast lower
 * third keeps to.
 *
 * The name is set larger than the pointer labels (which clamp to 0.9375rem) -
 * the user's call, over an eyebrow-sized credit that sat under them in the
 * hierarchy. Fixed sizes, not container units: this is the size it was picked
 * at.
 */
export interface CarSubteamTagProps {
  /** The subteam on screen, or null while no still is up. */
  subteam: string | null;
}

export default function CarSubteamTag({ subteam }: CarSubteamTagProps) {
  // The name it last had, so the box still has words to fade out with once the
  // beat has gone. Adjusted during render rather than from an effect: there is
  // nothing to schedule, because a beat always clears the name before the next
  // one arrives - every pause is bracketed by camera moves, with the tag down
  // through them (measured over the whole page: ten name changes, none of them
  // while it was up).
  const [shown, setShown] = useState({ subteam, text: subteam ?? "" });
  if (shown.subteam !== subteam) {
    setShown({ subteam, text: subteam ?? shown.text });
  }

  const up = subteam !== null;

  return (
    <div
      data-car-subteam={subteam ?? undefined}
      aria-hidden="true"
      // Classes rather than an inline transition, so motion-reduce can turn the
      // movement off - an inline style would outrank it. 220ms with an ease-out
      // is inside NN/g's 100-400ms band for scroll-triggered text, and the
      // entry waits out LABEL_MOTION's 0.12s settle so the credit arrives with
      // the labels rather than ahead of them.
      className={`pointer-events-none absolute bottom-[5%] left-[3.5%] z-[34] hidden select-none transition-[opacity,translate] duration-[220ms] ease-out motion-reduce:transition-none lg:block ${
        up ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      style={{ transitionDelay: up ? "120ms" : "0ms" }}
    >
      <p className="font-clash text-[0.625rem] font-medium uppercase leading-none tracking-[0.32em] text-livery">
        Built by
      </p>
      <p className="mt-2.5 font-clash text-[1.375rem] font-semibold uppercase leading-none tracking-[0.1em] text-white">
        {shown.text}
      </p>
    </div>
  );
}
