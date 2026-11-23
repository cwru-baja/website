"use client";

import { useSyncExternalStore } from "react";

// Whole seconds left until `target` (ms epoch), ticking once a second. null on
// the server and before hydration, so the static HTML never bakes in a time.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

export function useCountdown(target: number): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.floor((target - Date.now()) / 1000)),
    () => null,
  );
}

export function splitSeconds(s: number) {
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

