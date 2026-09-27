"use client";

import { useEffect } from "react";

/**
 * Keeps the screen from dimming or locking while `active`. The browser drops
 * the lock whenever the tab is hidden, so it is taken again on return. It
 * can't stop a closed lid or the laptop's own sleep timer: those are OS
 * settings (see the checklist on /host).
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else void next.release();
      } catch {
        // Refused (battery saver, or the tab lost focus). The next visibility change retries.
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
