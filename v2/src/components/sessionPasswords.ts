"use client";

import { useSyncExternalStore } from "react";

// The passwords typed into /host and /live, and whether the host asked to
// stream, kept in sessionStorage: a reload mid-race picks up where it was, but
// closing the tab forgets them (nothing is left behind on a borrowed laptop).
// Read through useSyncExternalStore so the prerendered page (no storage) and
// the browser agree during hydration.

const KEYS = { password: "hostPassword", streaming: "hostStreaming", watchPassword: "watchPassword" } as const;
type Key = keyof typeof KEYS;

const listeners = new Set<() => void>();

function read(key: Key): string | null {
  try {
    return window.sessionStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export function setSessionValue(key: Key, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(KEYS[key]);
    else window.sessionStorage.setItem(KEYS[key], value);
  } catch {
    // Storage blocked: the value lasts until the page closes, via memory below.
  }
  memory[key] = value;
  listeners.forEach((listener) => listener());
}

const memory: Record<Key, string | null | undefined> = {
  password: undefined,
  streaming: undefined,
  watchPassword: undefined,
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useSessionValue(key: Key): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (memory[key] !== undefined ? memory[key] ?? null : read(key)),
    () => null,
  );
}
