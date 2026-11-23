"use client";

import { useSyncExternalStore } from "react";

import { DARES_ENDS_AT } from "@/lib/daresEvent";

// The static HTML is built while the event runs, so the server snapshot says
// live; the browser checks the clock on hydration and once a minute after, so
// a page left open past the end still flips.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

export function useDaresLive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Date.now() < DARES_ENDS_AT,
    () => true,
  );
}
